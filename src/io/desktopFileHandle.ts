// Adapt the narrow, token-based Electron bridge to the File System Access shape already used by the
// editor. The renderer never receives an absolute path and the main process only accepts tokens it
// created for files opened by Windows, so web content cannot read or overwrite arbitrary files.

export function createDesktopFileHandle(
  initial: DesktopOpenFilePayload,
  desktop: IThreadDesktopBridge,
): FileSystemFileHandle {
  let firstRead: DesktopBoundFilePayload | null = {
    name: initial.name,
    bytes: new Uint8Array(initial.bytes),
    lastModified: initial.lastModified,
  };

  const handle = {
    kind: "file" as const,
    name: initial.name,
    async getFile() {
      const payload = firstRead ?? (await desktop.readBoundFile(initial.token));
      firstRead = null;
      return new File([new Uint8Array(payload.bytes)], payload.name, {
        type: "application/json",
        lastModified: payload.lastModified,
      });
    },
    async createWritable() {
      if (!initial.writable)
        throw new DOMException("This format is import-only", "NotAllowedError");
      let contents = "";
      return {
        async write(value: FileSystemWriteChunkType) {
          if (typeof value === "string") contents = value;
          else if (value instanceof Blob) contents = await value.text();
          else if (value instanceof ArrayBuffer) contents = new TextDecoder().decode(value);
          else if (ArrayBuffer.isView(value)) {
            const bytes = new Uint8Array(
              value.buffer as ArrayBuffer,
              value.byteOffset,
              value.byteLength,
            );
            contents = new TextDecoder().decode(bytes);
          } else if (value.type === "write") {
            const data = value.data;
            if (data == null) contents = "";
            else if (typeof data === "string") contents = data;
            else if (data instanceof Blob) contents = await data.text();
            else if (data instanceof ArrayBuffer) contents = new TextDecoder().decode(data);
            else {
              const bytes = new Uint8Array(
                data.buffer as ArrayBuffer,
                data.byteOffset,
                data.byteLength,
              );
              contents = new TextDecoder().decode(bytes);
            }
          }
        },
        async close() {
          await desktop.writeBoundFile(initial.token, contents);
          firstRead = null;
        },
        async abort() {},
        async seek() {},
        async truncate() {},
      } as unknown as FileSystemWritableFileStream;
    },
    async queryPermission() {
      return initial.writable ? "granted" : "denied";
    },
    async requestPermission() {
      return initial.writable ? "granted" : "denied";
    },
    async isSameEntry(other: FileSystemHandle) {
      return other === handle;
    },
  };
  return handle as FileSystemFileHandle;
}
