type t = int

let max_value_int = 0xFFFF

let of_int n =
  if n < 0 || n > max_value_int then
    invalid_arg "Int16.of_int: value does not fit in 16 bits";
  n

let to_int v = v
let zero = 0
let max_value = max_value_int
let compare = Int.compare
let equal = Int.equal
