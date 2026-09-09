import JSZip from 'jszip';
import CryptoJS from 'crypto-js';

export class EsxPackager {
  private static readonly KEY_STRING = 'XpYm&$i($#cds#4,>.?z-+:;}[}}[71!';

  static async createEsx(xmlString: string): Promise<Blob> {
    const xmlBytes = new TextEncoder().encode(xmlString);

    const innerZip = new JSZip();
    innerZip.file('XACTDOC.XML', xmlBytes);
    const innerZipBytes = await innerZip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const encryptedPayload = this.encryptAES(innerZipBytes);

    const outerZip = new JSZip();
    outerZip.file('XACTDOC.ZIPXML', encryptedPayload);
    return await outerZip.generateAsync({ type: 'blob' });
  }

  private static encryptAES(plainBytes: Uint8Array): Uint8Array {
    const L = plainBytes.length;
    const paddedLength = Math.ceil((L + 4) / 16) * 16;
    const num = paddedLength - L - 4;

    const paddedBytes = new Uint8Array(paddedLength);
    paddedBytes.set(plainBytes, 0);

    const keyWordArray = CryptoJS.enc.Latin1.parse(this.KEY_STRING);
    const paddedWordArray = this.uint8ArrayToWordArray(paddedBytes);

    const encrypted = CryptoJS.AES.encrypt(paddedWordArray, keyWordArray, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.NoPadding,
    });

    const ciphertextBytes = this.wordArrayToUint8Array(encrypted.ciphertext);
    const result = new Uint8Array(4 + ciphertextBytes.length);
    result[0] = 0x00;
    result[1] = 0x00;
    result[2] = 0x00;
    result[3] = num;
    result.set(ciphertextBytes, 4);

    return result;
  }

  private static uint8ArrayToWordArray(u8Array: Uint8Array): CryptoJS.lib.WordArray {
    const words: number[] = [];
    for (let i = 0; i < u8Array.length; i += 4) {
      words.push(
        ((u8Array[i] || 0) << 24) |
        ((u8Array[i + 1] || 0) << 16) |
        ((u8Array[i + 2] || 0) << 8) |
        (u8Array[i + 3] || 0)
      );
    }
    return CryptoJS.lib.WordArray.create(words, u8Array.length);
  }

  private static wordArrayToUint8Array(wordArray: CryptoJS.lib.WordArray): Uint8Array {
    const len = wordArray.sigBytes;
    const u8 = new Uint8Array(len);
    let offset = 0;
    for (let i = 0; i < wordArray.words.length && offset < len; i++) {
      const word = wordArray.words[i];
      u8[offset++] = (word >> 24) & 0xff;
      if (offset < len) u8[offset++] = (word >> 16) & 0xff;
      if (offset < len) u8[offset++] = (word >> 8) & 0xff;
      if (offset < len) u8[offset++] = word & 0xff;
    }
    return u8;
  }
}