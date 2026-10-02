/** An error with an HTTP status the app can act on (it falls back on any error). */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
