/* Loads the PDF reader (PDF.js, run on the person's own device) and makes it available to the app as window.pdfjsLib */
import * as pdfjs from './pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.min.mjs', import.meta.url).href;
window.pdfjsLib = pdfjs;
