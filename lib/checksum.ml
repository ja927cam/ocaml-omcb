let offset_basis = 0xcbf29ce484222325L
let prime = 0x100000001b3L
let empty = offset_basis

let int64 h v = Int64.mul (Int64.logxor h v) prime

let byte h b = int64 h (Int64.of_int (b land 0xff))

let bytes h b off len =
  let acc = ref h in
  for i = off to off + len - 1 do
    acc := byte !acc (Char.code (Bytes.unsafe_get b i))
  done;
  !acc

let words h a off len =
  let acc = ref h in
  for i = off to off + len - 1 do
    acc := int64 !acc (Bigarray.Array1.unsafe_get a i)
  done;
  !acc

let to_hex h = Printf.sprintf "%016Lx" h
