// Helpers for turning an authenticated axios blob response into a browser
// file download, without ever navigating to the API URL directly.

const parseFilename = (disposition, fallback) => {
  if (!disposition) return fallback;

  // RFC 5987 form: filename*=UTF-8''my%20file.pdf
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      return utf8[1].trim();
    }
  }

  // Plain form: filename="my file.pdf"
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  if (plain) return plain[1].trim();

  return fallback;
};

/**
 * Save an axios response that carries a file (responseType: 'blob').
 * Throws a readable Error when the server actually sent a JSON error body or
 * an empty file, so callers can surface it instead of downloading junk.
 */
export const saveBlobResponse = async (response, fallbackFilename) => {
  const { data } = response;
  const contentType = response.headers?.['content-type'] || '';

  // A JSON body means the download failed (401/403/422/500) even though axios
  // resolves for 2xx only — this covers proxies that return 200 with an error.
  const looksLikeJson =
    contentType.includes('application/json') ||
    (data && data.type === 'application/json');

  if (looksLikeJson) {
    let message = 'The export could not be generated.';
    try {
      const parsed = JSON.parse(await data.text());
      message = parsed.message || message;
    } catch {
      // keep the default message
    }
    throw new Error(message);
  }

  if (!data || data.size === 0) {
    throw new Error('The generated file was empty. Try adjusting the filters and export again.');
  }

  const filename = parseFilename(response.headers?.['content-disposition'], fallbackFilename);
  const objectUrl = window.URL.createObjectURL(data);

  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Revoke on the next tick so the download has definitely started.
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
  }

  return filename;
};

/**
 * Normalise an axios error from a blob request into a readable message.
 * The response interceptor can't read message text out of a Blob, so we do it
 * here.
 */
export const readDownloadError = async (error) => {
  const data = error?.response?.data;

  if (data && typeof data.text === 'function') {
    try {
      const parsed = JSON.parse(await data.text());
      if (parsed?.message) return parsed.message;
    } catch {
      // not JSON, fall through
    }
  }

  return error?.friendlyMessage || error?.message || 'The export failed. Please try again.';
};
