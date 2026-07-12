import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { AppLauncher } from '@capacitor/app-launcher';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Servicio de compartición y envío de reportes
 * Integra Outlook nativo (si está disponible) y proporciona fallback a mailto:
 */

export const emailService = {
  isNative() {
    return Boolean(window?.Capacitor?.isNativePlatform?.());
  },

  /**
   * Detecta si Outlook está disponible en el dispositivo
   * @returns {Promise<boolean>}
   */
  async isOutlookAvailable() {
    try {
      if (!this.isNative()) return false;
      const result = await AppLauncher.canOpenUrl({ url: 'ms-outlook://' });
      return Boolean(result?.value);
    } catch (error) {
      return false;
    }
  },

  /**
   * Convierte un elemento HTML a PNG Blob
   * @param {HTMLElement} element - Elemento a convertir
   * @returns {Promise<Blob>}
   */
  async elementToImageBlob(element) {
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      return new Promise(resolve => {
        canvas.toBlob(resolve, 'image/png');
      });
    } catch (error) {
      console.error('Error converting element to image:', error);
      throw error;
    }
  },

  /**
   * Convierte un elemento HTML a PDF
   * @param {HTMLElement} element - Elemento a convertir
   * @param {string} filename - Nombre del archivo PDF (sin extensión)
   * @returns {Promise<Blob>}
   */
  async elementToPdfBlob(element) {
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // Calcular dimensiones para PDF
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      const pdf = new jsPDF('p', 'mm', 'a4');
      let position = 0;

      // Agregar imagen al PDF
      const imgData = canvas.toDataURL('image/png');
      while (heightLeft >= 0) {
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        position -= pageHeight;
        if (heightLeft > 0) {
          pdf.addPage();
        }
      }

      return pdf.output('blob');
    } catch (error) {
      console.error('Error converting element to PDF:', error);
      throw error;
    }
  },

  /**
   * Envía reporte por email via Outlook (Android nativo)
   * @param {Object} options
   * @param {HTMLElement} options.element - Elemento a compartir
   * @param {string} options.subject - Asunto del email
   * @param {string} options.body - Cuerpo del email
   * @param {string} options.format - 'image' o 'pdf' (default: 'image')
   * @param {string} options.filename - Nombre del archivo para PDF
   * @returns {Promise<boolean>} - true si se envió, false si no fue posible
   */
  async sendViaOutlook({ element, subject, body, format = 'image', filename = 'reporte' }) {
    try {
      if (!this.isNative() || !Share) {
        return false;
      }

      // No bloqueamos si Outlook no está — Share.share() abre la hoja nativa
      // y el usuario puede seleccionar Outlook u otra app de correo instalada.

      let blob;
      let ext;
      let mimeType;

      if (format === 'pdf') {
        blob = await this.elementToPdfBlob(element);
        ext = 'pdf';
        mimeType = 'application/pdf';
      } else {
        blob = await this.elementToImageBlob(element);
        ext = 'png';
        mimeType = 'image/png';
      }

      const base64Data = await this.blobToBase64(blob);
      const sanitizedName = String(filename || 'reporte').replace(/[^a-zA-Z0-9_-]/g, '_');
      const path = `reports/${sanitizedName}_${Date.now()}.${ext}`;

      await Filesystem.writeFile({
        path,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });

      const fileUri = await Filesystem.getUri({
        path,
        directory: Directory.Cache,
      });

      await Share.share({
        title: subject,
        text: body,
        files: [fileUri.uri],
        dialogTitle: 'Enviar reporte',
      });

      return true;
    } catch (error) {
      console.error('Error sending via Outlook:', error);
      throw error;
    }
  },

  /**
   * Envía reporte por email via mailto: (fallback multiplataforma)
   * Copia la imagen al portapapeles y abre cliente de email
   * @param {Object} options
   * @param {HTMLElement} options.element - Elemento a compartir
   * @param {string} options.subject - Asunto del email
   * @param {string} options.body - Cuerpo del email
   * @param {string} options.format - 'image' o 'pdf'
   */
  async sendViaMailto({ element, subject, body, format = 'image', filename = 'reporte' }) {
    try {
      let blob;
      let ext;

      if (format === 'pdf') {
        blob = await this.elementToPdfBlob(element);
        ext = 'pdf';
      } else {
        blob = await this.elementToImageBlob(element);
        ext = 'png';
      }

      const safeName = String(filename || 'reporte').replace(/[^a-zA-Z0-9_-]/g, '_');
      await this.downloadBlob(blob, `${safeName}.${ext}`);

      const encodedSubject = encodeURIComponent(subject);
      const encodedBody = encodeURIComponent(body);
      window.location.href = `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
    } catch (error) {
      console.error('Error sending via mailto:', error);
      throw error;
    }
  },

  /**
   * Envía reporte automáticamente detectando la mejor opción disponible
   * @param {Object} options - Mismas opciones que sendViaOutlook
   */
  async sendReport(options) {
    try {
      const { element, subject, body, format = 'image', filename = 'reporte' } = options;

      if (!element) {
        throw new Error('No se encontró el elemento del reporte');
      }

      // En nativo, exigir Outlook instalado y enviar con adjunto real
      if (this.isNative()) {
        await this.sendViaOutlook({ element, subject, body, format, filename });
        return { success: true, method: 'outlook' };
      }

      // En web, fallback a descarga + mailto (no hay adjunto automatico fiable)
      await this.sendViaMailto({ element, subject, body, format, filename });
      return { success: true, method: 'mailto' };
    } catch (error) {
      console.error('Error in sendReport:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Convierte Blob a base64
   * @param {Blob} blob
   * @returns {Promise<string>}
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  /**
   * Descarga un blob como archivo
   * @param {Blob} blob
   * @param {string} filename
   */
  async downloadBlob(blob, filename) {
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading blob:', error);
      throw error;
    }
  },

  /**
   * Solicita al usuario instalar una aplicación específica
   * @param {string} appName - Nombre de la app (ej: "Outlook")
   * @param {string} packageName - Package name en Android (ej: "com.microsoft.office.outlook")
   */
  async requestInstallApp(appName, packageName) {
    const userConfirm = confirm(
      `${appName} no esta instalado en tu dispositivo.\n\n` +
      `¿Deseas instalar ${appName} desde Google Play?`
    );

    if (userConfirm) {
      // Redirigir a Google Play
      if (window.capacitor) {
        window.open(
          `https://play.google.com/store/apps/details?id=${packageName}`,
          '_blank'
        );
      } else {
        // Fallback en web
        alert(`Descarga ${appName} desde:\nhttps://play.google.com/store/apps/details?id=${packageName}`);
      }
    }
  }
};
