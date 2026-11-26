import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ClienteServicios, NombreServicio, UsuarioToken } from '@app/comun';
import { AdministrarUsuarioDto, LoginDto, RegistroDto, SesionDto, UsuarioDto } from './auth.dto';
import { Consentimiento, TipoToken, Token, Usuario } from './auth.entity';

const DIA = 24 * 60 * 60 * 1000;
const VIDA_REFRESCO = 30 * DIA;
const VIDA_RECUPERACION = 30 * 60 * 1000;
/** Servicios que guardan datos del usuario y deben borrarlos al eliminar la cuenta. */
const CON_DATOS: NombreServicio[] = ['salud', 'entrenamiento', 'nutricion', 'fati'];

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const versionAviso = () => process.env.AVISO_VERSION ?? '2026-11';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Consentimiento) private readonly consentimientos: Repository<Consentimiento>,
    @InjectRepository(Token) private readonly tokens: Repository<Token>,
    private readonly db: DataSource,
    private readonly jwt: JwtService,
    private readonly servicios: ClienteServicios,
  ) {}

  aDto(u: Usuario): UsuarioDto {
    return { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol, activo: u.activo, creadoEn: u.creadoEn };
  }

  async registrar(dto: RegistroDto): Promise<SesionDto> {
    if (await this.usuarios.existsBy({ correo: dto.correo })) throw new ConflictException('Ya existe una cuenta con ese correo.');
    const contrasenaHash = await bcrypt.hash(dto.contrasena, 10);
    // La cuenta y su consentimiento se guardan juntos o no se guarda nada.
    const usuario = await this.db.transaction(async (tx) => {
      const u = await tx.save(Usuario, tx.create(Usuario, { nombre: dto.nombre, correo: dto.correo, contrasenaHash, rol: dto.rol ?? 'usuario', activo: true }));
      await tx.save(Consentimiento, [
        tx.create(Consentimiento, { usuarioId: u.id, tipo: 'terminos', version: versionAviso() }),
        tx.create(Consentimiento, { usuarioId: u.id, tipo: 'datos_salud', version: versionAviso() }),
      ]);
      return u;
    });
    return this.abrirSesion(usuario);
  }

  async login(dto: LoginDto): Promise<SesionDto> {
    const u = await this.usuarios.findOneBy({ correo: dto.correo });
    // Mismo mensaje si no existe el correo o falla la contraseña.
    if (!u || !(await bcrypt.compare(dto.contrasena, u.contrasenaHash))) throw new UnauthorizedException('Correo o contraseña incorrectos.');
    if (!u.activo) throw new ForbiddenException('Tu cuenta está desactivada.');
    return this.abrirSesion(u);
  }

  async refrescar(tokenRefresco: string): Promise<SesionDto> {
    const t = await this.consumirToken(tokenRefresco, 'refresco');
    const u = await this.usuarios.findOneBy({ id: t.usuarioId });
    if (!u?.activo) throw new UnauthorizedException('Sesión no válida.');
    return this.abrirSesion(u);
  }

  async cerrarSesion(usuarioId: string) {
    await this.tokens.delete({ usuarioId, tipo: 'refresco' });
  }

  /** Devuelve el token de recuperación (o null si el correo no existe). En producción se enviaría por correo. */
  async pedirRecuperacion(correo: string): Promise<string | null> {
    const u = await this.usuarios.findOneBy({ correo });
    if (!u?.activo) return null;
    await this.tokens.delete({ usuarioId: u.id, tipo: 'recuperacion' });
    return this.crearToken(u.id, 'recuperacion', VIDA_RECUPERACION);
  }

  async restablecer(token: string, contrasena: string) {
    const t = await this.consumirToken(token, 'recuperacion');
    await this.usuarios.update(t.usuarioId, { contrasenaHash: await bcrypt.hash(contrasena, 10) });
    await this.cerrarSesion(t.usuarioId);
  }

  async yo(id: string) {
    const u = await this.buscar(id);
    return { ...this.aDto(u), consentimiento: await this.consentimientoSalud(id) };
  }

  async actualizarNombre(id: string, nombre: string) {
    const u = await this.buscar(id);
    u.nombre = nombre;
    return this.aDto(await this.usuarios.save(u));
  }

  async cambiarContrasena(id: string, actual: string, nueva: string) {
    const u = await this.buscar(id);
    if (!(await bcrypt.compare(actual, u.contrasenaHash))) throw new UnauthorizedException('La contraseña actual no coincide.');
    await this.usuarios.update(id, { contrasenaHash: await bcrypt.hash(nueva, 10) });
    await this.cerrarSesion(id);
  }

  /**
   * Borrado total: primero cada servicio elimina los datos del usuario y solo
   * si todos lo lograron se borra la cuenta, para no dejar datos huérfanos.
   */
  async eliminarCuenta(id: string, contrasena: string) {
    const u = await this.buscar(id);
    if (!(await bcrypt.compare(contrasena, u.contrasenaHash))) throw new UnauthorizedException('La contraseña no coincide.');
    for (const s of CON_DATOS) await this.servicios.pedir(s, `/interno/usuarios/${id}`, { metodo: 'DELETE', interno: true });
    await this.usuarios.delete(id); // consentimientos y tokens caen en cascada
  }

  // ---------- Administración ----------

  async listar(buscar?: string, rol?: string) {
    const q = this.usuarios.createQueryBuilder('u').orderBy('u.creadoEn', 'DESC').take(200);
    if (buscar) q.andWhere('(u.correo ILIKE :b OR u.nombre ILIKE :b)', { b: `%${buscar}%` });
    if (rol) q.andWhere('u.rol = :rol', { rol });
    return (await q.getMany()).map((u) => this.aDto(u));
  }

  async administrar(actor: UsuarioToken, id: string, dto: AdministrarUsuarioDto) {
    if (actor.id === id) throw new ForbiddenException('No puedes cambiar tu propio rol ni desactivarte.');
    const u = await this.buscar(id);
    if (dto.activo !== undefined) u.activo = dto.activo;
    if (dto.rol !== undefined) u.rol = dto.rol;
    if (!u.activo) await this.cerrarSesion(id);
    return this.aDto(await this.usuarios.save(u));
  }

  // ---------- Internos ----------

  private async buscar(id: string) {
    const u = await this.usuarios.findOneBy({ id });
    if (!u) throw new NotFoundException('La cuenta ya no existe.');
    return u;
  }

  private async consentimientoSalud(usuarioId: string) {
    const c = await this.consentimientos.findOne({ where: { usuarioId, tipo: 'datos_salud' }, order: { aceptadoEn: 'DESC' } });
    return c ? { version: c.version, fecha: c.aceptadoEn } : null;
  }

  private async abrirSesion(u: Usuario): Promise<SesionDto> {
    return {
      usuario: this.aDto(u),
      tokenAcceso: this.jwt.sign({ sub: u.id, correo: u.correo, nombre: u.nombre, rol: u.rol }),
      tokenRefresco: await this.crearToken(u.id, 'refresco', VIDA_REFRESCO),
      consentimiento: await this.consentimientoSalud(u.id),
    };
  }

  private async crearToken(usuarioId: string, tipo: TipoToken, vidaMs: number) {
    const valor = randomBytes(32).toString('hex');
    await this.tokens.save(this.tokens.create({ usuarioId, tipo, tokenHash: sha256(valor), expiraEn: new Date(Date.now() + vidaMs), usadoEn: null }));
    return valor;
  }

  /** Marca el token como usado de forma atómica: un token no sirve dos veces. */
  private async consumirToken(valor: string, tipo: TipoToken) {
    const t = await this.tokens.findOneBy({ tokenHash: sha256(valor), tipo });
    if (!t || t.usadoEn || t.expiraEn < new Date()) throw new UnauthorizedException('El token no es válido o ya venció.');
    const r = await this.tokens.update({ id: t.id, usadoEn: IsNull() }, { usadoEn: new Date() });
    if (!r.affected) throw new UnauthorizedException('El token ya fue usado.');
    return t;
  }
}
