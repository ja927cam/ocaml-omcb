type client_msg =
  | Move of { x : float; y : float }
  | Cast_ray of { angle : float }
[@@deriving yojson]
