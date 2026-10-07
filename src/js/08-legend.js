/* =========================================================================
   LEGEND (danh sách 7 loại quân)
   ========================================================================= */
const PIECE_SUMMARY = {
  G:'Đi 1 ô ngang/dọc, không rời khỏi cung; hai Tướng không được đối mặt trên cùng cột trống.',
  A:'Đi 1 ô chéo, không rời khỏi cung.',
  E:'Đi chéo 2 ô, không qua sông, bị chặn nếu có quân ở giữa đường.',
  H:'Đi hình chữ L, bị chặn nếu có quân ngay cạnh (chân mã).',
  R:'Đi thẳng bao xa tuỳ ý, dừng khi gặp quân cản.',
  C:'Đi thẳng như Xe; muốn ăn quân phải nhảy qua đúng 1 quân khác.',
  S:'Chỉ tiến, chưa qua sông đi thẳng; qua sông rồi được đi ngang.',
};
function buildLegend(){
  const grid=document.getElementById('legendGrid');
  const order=['G','A','E','H','R','C','S'];
  grid.innerHTML = order.map(t=>`
    <div class="legend-item">
      <div class="legend-chars">
        <span class="legend-char red" title="${VN_NAME[t]} Đỏ">${PIECE_CHAR.red[t]}</span>
        <span class="legend-char black" title="${VN_NAME[t]} Đen">${PIECE_CHAR.black[t]}</span>
      </div>
      <div class="legend-text">
        <b>${VN_NAME[t]} <em class="legend-code">(${Notation.LETTER[t]})</em></b>
        <span>${PIECE_SUMMARY[t]}</span>
      </div>
    </div>`).join('');
}

