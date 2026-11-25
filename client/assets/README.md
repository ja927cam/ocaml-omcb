# Piece artwork

`pieces.png` is a 6 × 2 atlas generated from the **Cburnett** chess piece SVG
set by Cburnett, via Wikimedia Commons:

<https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces>

The Cburnett pieces are licensed under the Creative Commons
Attribution-ShareAlike 3.0 Unported license and the GNU Free Documentation
License. The atlas is distributed under the same terms. It is rendered at
512 × 512 pixels per cell and arranged as:

- row 0: white pawn, knight, bishop, rook, queen, king;
- row 1: black pawn, knight, bishop, rook, queen, king.

To regenerate it, render each source SVG on a transparent background, trim,
fit it to 460 × 460 inside a 512 × 512 cell, then append six cells per row.
