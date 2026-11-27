/**
 * @archivo servicioPdf.ts
 * @proyecto Civil Trace
 * @descripcion Dibuja en PDF el reporte de avance de una entrega y su acta de entrega-recepción con
 *   pdfkit (research R-01). Solo arma el documento; los datos los reúne servicioDocumentosEntrega.
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.1.0
 * @requerimientos RF-12 Generar reporte de avance de obra, RF-16 Generar acta de
 *   entrega-recepción, RF-71 Descargar documentos de una entrega en el portal
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 *   25/11/2026 - Emilio Manuel Esquivel - Ubicación de cada foto (feature 007, RF-08)
 */

// 1. Importaciones
import PDFDocument from 'pdfkit';

// 2. Tipos e interfaces
export interface FotoDocumento {
  comentario: string;
  fechaHora: string;
  // "Ubicación: lat, long", "Sin ubicación GPS · Referencia: …" o "Ubicación no registrada".
  ubicacion: string;
  imagen: Buffer | null;
}

export interface ActividadDocumento {
  nombre: string;
  descripcion: string;
  estado: string;
  fechaEntrega: string;
  fotos: FotoDocumento[];
}

export interface AceptacionDocumento {
  nombreCliente: string;
  fechaHora: string;
  firma: Buffer | null;
  firmaSha256: string;
}

export interface DatosDocumentoEntrega {
  empresa: string;
  obra: string;
  cliente: string | null;
  direccion: string;
  periodo: string;
  enviadaEn: string;
  actividades: ActividadDocumento[];
  aceptacion?: AceptacionDocumento;
}

type DocumentoPdf = InstanceType<typeof PDFDocument>;

// 3. Constantes del módulo
const MARGEN = 50;
const COLOR_PRIMARIO = '#1E6FD9';
const COLOR_TEXTO = '#1F2937';
const COLOR_SECUNDARIO = '#6B7280';
const ANCHO_FOTO = 240;
const ALTO_FOTO = 180;
const ANCHO_FIRMA = 200;
const ALTO_FIRMA = 90;
const LEYENDA_CONSTANCIA =
  'La firma se guarda como imagen junto con la fecha y la hora de la aceptación. Es una constancia de recepción; no es una firma electrónica avanzada.';

// 4. Funciones privadas
function asegurarEspacio(documento: DocumentoPdf, alto: number): void {
  if (documento.y + alto > documento.page.height - MARGEN) {
    documento.addPage();
  }
}

// Una foto dañada o en un formato que pdfkit no lee no debe impedir el documento completo.
function dibujarImagen(
  documento: DocumentoPdf,
  imagen: Buffer | null,
  ancho: number,
  alto: number,
): void {
  asegurarEspacio(documento, alto + 10);
  if (imagen) {
    try {
      const y = documento.y;
      documento.image(imagen, MARGEN, y, { fit: [ancho, alto] });
      documento.y = y + alto + 6;
      return;
    } catch {
      // Se escribe el aviso de abajo.
    }
  }
  documento.fillColor(COLOR_SECUNDARIO).fontSize(9).text('(Imagen no disponible)');
}

function dibujarEncabezado(
  documento: DocumentoPdf,
  titulo: string,
  datos: DatosDocumentoEntrega,
): void {
  documento.fillColor(COLOR_PRIMARIO).fontSize(20).text(titulo);
  documento.moveDown(0.3);
  documento.fillColor(COLOR_TEXTO).fontSize(11);
  documento.text(`Empresa: ${datos.empresa}`);
  documento.text(`Obra: ${datos.obra}`);
  if (datos.cliente) {
    documento.text(`Cliente: ${datos.cliente}`);
  }
  documento.text(`Dirección: ${datos.direccion}`);
  documento.text(`Periodo: ${datos.periodo}`);
  documento.text(`Enviada: ${datos.enviadaEn}`);
  documento.moveDown();
}

function dibujarActividades(documento: DocumentoPdf, actividades: ActividadDocumento[]): void {
  documento.fillColor(COLOR_PRIMARIO).fontSize(14).text('Actividades');
  documento.moveDown(0.5);
  for (const actividad of actividades) {
    asegurarEspacio(documento, 60);
    documento.fillColor(COLOR_TEXTO).fontSize(12).text(actividad.nombre);
    documento.fillColor(COLOR_SECUNDARIO).fontSize(10);
    documento.text(`Estado: ${actividad.estado} · Fecha programada: ${actividad.fechaEntrega}`);
    if (actividad.descripcion) {
      documento.text(actividad.descripcion);
    }
    documento.moveDown(0.3);
    for (const foto of actividad.fotos) {
      dibujarImagen(documento, foto.imagen, ANCHO_FOTO, ALTO_FOTO);
      const pie = foto.comentario ? `${foto.fechaHora} · ${foto.comentario}` : foto.fechaHora;
      documento.fillColor(COLOR_TEXTO).fontSize(9).text(pie);
      documento.fillColor(COLOR_SECUNDARIO).fontSize(8).text(foto.ubicacion);
      documento.moveDown(0.5);
    }
    documento.moveDown();
  }
}

function dibujarAceptacion(documento: DocumentoPdf, aceptacion: AceptacionDocumento): void {
  asegurarEspacio(documento, ALTO_FIRMA + 120);
  documento.fillColor(COLOR_PRIMARIO).fontSize(14).text('Registro de aceptación del cliente');
  documento.moveDown(0.5);
  documento.fillColor(COLOR_TEXTO).fontSize(11);
  documento.text(`Aceptado por: ${aceptacion.nombreCliente}`);
  documento.text(`Fecha y hora: ${aceptacion.fechaHora}`);
  documento.moveDown(0.3);
  dibujarImagen(documento, aceptacion.firma, ANCHO_FIRMA, ALTO_FIRMA);
  documento.fillColor(COLOR_SECUNDARIO).fontSize(8);
  documento.text(`Huella SHA-256 de la firma: ${aceptacion.firmaSha256}`);
  documento.moveDown(0.3);
  documento.text(LEYENDA_CONSTANCIA);
}

// Los escuchas se conectan antes de dibujar: pdfkit empieza a emitir datos desde la primera página.
function recolectarBytes(documento: DocumentoPdf): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    const partes: Buffer[] = [];
    documento.on('data', (parte: Buffer) => partes.push(parte));
    documento.on('end', () => resolver(Buffer.concat(partes)));
    documento.on('error', rechazar);
  });
}

function crearDocumento(titulo: string, obra: string): DocumentoPdf {
  return new PDFDocument({
    size: 'LETTER',
    margin: MARGEN,
    // Sin compresión el texto queda legible para las pruebas; las fotos pesan mucho más.
    compress: false,
    info: { Title: `${titulo} - ${obra}`, Author: 'Civil Trace' },
  });
}

// 5. Funciones públicas
/**
 * @param datos - Datos ya reunidos de la entrega.
 * @returns El reporte de avance en PDF (RF-12, RF-71).
 */
export async function generarReporteEntrega(datos: DatosDocumentoEntrega): Promise<Buffer> {
  const titulo = 'Reporte de avances';
  const documento = crearDocumento(titulo, datos.obra);
  const bytes = recolectarBytes(documento);
  dibujarEncabezado(documento, titulo, datos);
  dibujarActividades(documento, datos.actividades);
  documento.end();
  return bytes;
}

/**
 * @param datos - Datos de la entrega con su aceptación.
 * @returns El acta de entrega-recepción en PDF (RF-16).
 */
export async function generarActaEntrega(
  datos: DatosDocumentoEntrega & { aceptacion: AceptacionDocumento },
): Promise<Buffer> {
  const titulo = 'Acta de entrega-recepción';
  const documento = crearDocumento(titulo, datos.obra);
  const bytes = recolectarBytes(documento);
  dibujarEncabezado(documento, titulo, datos);
  dibujarActividades(documento, datos.actividades);
  dibujarAceptacion(documento, datos.aceptacion);
  documento.end();
  return bytes;
}
