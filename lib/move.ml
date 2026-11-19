type t = {
  src : Board.position;
  dst : Board.position;
}

let create ~src ~dst = { src; dst }

let position_to_string p =
  Printf.sprintf "board(%d,%d) square(%d,%d)" p.Board.board.board_x
    p.board.board_y p.square.x p.square.y

let to_string m =
  Printf.sprintf "%s -> %s" (position_to_string m.src)
    (position_to_string m.dst)
