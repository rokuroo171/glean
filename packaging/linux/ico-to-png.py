import struct, zlib, sys

def ico_to_png(data):
    _, _, n = struct.unpack('<HHH', data[:6])
    best = None
    best_sz = 0
    for i in range(n):
        entry = data[6 + i*16:6 + (i+1)*16]
        w = entry[4] or 256
        h = entry[5] or 256
        if w * h > best_sz:
            best_sz = w * h
            offset = struct.unpack('<I', entry[12:16])[0]
            size = struct.unpack('<I', entry[8:12])[0]
            best = (w, h, offset, size)
    w, h, offset, size = best
    bmp = data[offset:offset+size]
    ih_size = struct.unpack('<I', bmp[:4])[0]
    row_bytes = ((w * 4 + 3) // 4) * 4
    pixel_offset = 40
    rows = []
    for y in range(h - 1, -1, -1):
        row_off = pixel_offset + y * row_bytes
        row = []
        for x in range(w):
            b, g, r, a = struct.unpack('BBBB', bmp[row_off + x*4:row_off + x*4 + 4])
            row.append((r, g, b, 255 - a))
        rows.append(row)
    def make_png(w, h, rows):
        def chunk(ctype, cdata):
            c = ctype + cdata
            return struct.pack('>I', len(cdata)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
        sig = b'\x89PNG\r\n\x1a\n'
        ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
        raw = b''
        for row in rows:
            raw += b'\x00' + b''.join(struct.pack('BBBB', r, g, b, a) for r, g, b, a in row)
        return sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
    return make_png(w, h, rows)

with open(sys.argv[1], 'rb') as f:
    data = f.read()
png = ico_to_png(data)
with open(sys.argv[2], 'wb') as f:
    f.write(png)
print(f'Converted ico to PNG: {len(png)} bytes')
