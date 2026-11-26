/* Medical and research icons for the graphical abstract, drawn on a 24-unit grid as line icons.
 * Every icon is made of circles, rectangles and straight-segment paths only (curves are sampled into points),
 * so it goes into every export, including the editable PowerPoint slide, through the usual RT drawing calls.
 * RT.medIcon(id, x, y, size, color) returns the SVG and records the parts in the current scene.
 * After editing, change the ?v= on this file's <script> tag in graphical/index.html. */
(() => {
  const RT = window.RT;
  // a point on an ellipse; angles in degrees, 0 at 3 o'clock, growing clockwise (screen y points down)
  const pt = (cx, cy, rx, ry, a) => [cx + rx * Math.cos((a * Math.PI) / 180), cy + ry * Math.sin((a * Math.PI) / 180)];
  const arc = (cx, cy, rx, ry, a0, a1, n = 14) => Array.from({ length: n + 1 }, (_, i) => pt(cx, cy, rx, ry, a0 + ((a1 - a0) * i) / n));
  // a smooth curve through the points (Catmull–Rom), closed or open
  const smooth = (P, closed = true, seg = 6) => {
    const out = [], n = P.length, g = (i) => (closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))]);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
      for (let t = 0; t < seg; t++) {
        const s = t / seg, s2 = s * s, s3 = s2 * s;
        out.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * s + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * s2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * s3)));
      }
    }
    if (!closed) out.push(P[n - 1]);
    return out;
  };
  const L = (...pts) => ({ t: 'l', pts });
  const LP = (pts) => ({ t: 'l', pts });
  const S = (pts, fill) => ({ t: 's', pts, fill });
  const C = (cx, cy, r, fill) => ({ t: 'c', cx, cy, r, fill });
  const R = (x, y, w, h, r = 0, fill) => ({ t: 'r', x, y, w, h, r, fill });
  const person = (cx = 12, head = 6.5, hr = 3.2, sh = 18, sw = 7) => [C(cx, head, hr), LP([[cx - sw, 21], [cx - sw, sh], ...arc(cx, sh, sw, 4.5, 180, 360), [cx + sw, 21]])];
  const cross = (x, y, s) => [L([x, y - s], [x, y + s]), L([x - s, y], [x + s, y])];
  const heart = () => S(Array.from({ length: 48 }, (_, i) => { const t = (i / 48) * 2 * Math.PI; return [12 + 0.58 * 16 * Math.sin(t) ** 3, 11.2 - 0.58 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]; }));
  const helix = (dir) => Array.from({ length: 25 }, (_, i) => { const y = 2 + (20 * i) / 24; return [12 + dir * 5 * Math.sin(((y - 2) / 20) * 2.5 * Math.PI), y]; });

  const ICONS = {
    // people
    person: { g: 'people', zh: '人', en: 'Person', d: () => person() },
    people: { g: 'people', zh: '族群', en: 'People', d: () => [C(16.5, 6.8, 2.6), LP([[22, 19], [22, 16.5], ...arc(16.5, 16.5, 5.5, 3.6, 270, 360)]), ...person(9.5, 7.2, 3, 18, 6.5)] },
    child: { g: 'people', zh: '兒童', en: 'Child', d: () => [C(12, 8, 3.6), LP([[7, 21], [7, 18.5], ...arc(12, 18.5, 5, 4, 180, 360), [17, 21]])] },
    elderly: { g: 'people', zh: '長者', en: 'Older adult', d: () => [C(10, 5, 2.6), L([10.5, 8], [9, 14], [10.5, 21]), L([9, 14], [7, 21]), L([9.8, 10], [14.5, 13]), L([15, 12.5], [15, 21]), LP(arc(16, 12.5, 1, 1, 180, 360))] },
    pregnant: { g: 'people', zh: '孕婦', en: 'Pregnancy', d: () => [C(11, 4.8, 2.5), L([9, 8], [8.5, 15], [9.5, 21]), LP([[11.5, 8], [11.5, 11.5], ...arc(12.3, 14.8, 3.4, 3.4, 270, 450), [11.5, 18], [12, 21]])] },
    doctor: { g: 'people', zh: '醫師', en: 'Clinician', d: () => [...person(), ...cross(15.5, 18.2, 1.4)] },
    patient: { g: 'people', zh: '住院病人', en: 'Inpatient', d: () => [L([2, 7], [2, 20]), L([2, 15.5], [22, 15.5], [22, 20]), R(8, 11.5, 14, 4, 1.5), C(5.2, 12.2, 2.1)] },
    family: { g: 'people', zh: '家庭', en: 'Family', d: () => [C(7, 6, 2.4), LP([[3, 21], [3, 16], ...arc(7, 16, 4, 3.4, 180, 360), [11, 21]]), C(17, 6, 2.4), LP([[13, 21], [13, 16], ...arc(17, 16, 4, 3.4, 180, 360), [21, 21]]), C(12, 13, 1.7), LP([[10, 21], [10, 19], ...arc(12, 19, 2, 1.8, 180, 360), [14, 21]])] },
    // medicines
    capsule: { g: 'drug', zh: '膠囊', en: 'Capsule', d: () => [R(3, 8.5, 18, 7, 3.5), S([...arc(6.5, 12, 3.5, 3.5, 90, 270), [12, 8.5], [12, 15.5]], true)] },
    tablet: { g: 'drug', zh: '錠劑', en: 'Tablet', d: () => [C(12, 12, 8), L([6.5, 12], [17.5, 12])] },
    bottle: { g: 'drug', zh: '藥罐', en: 'Pill bottle', d: () => [R(7, 3, 10, 3.5, 1), R(6, 6.5, 12, 14.5, 2), R(8.5, 11, 7, 5, 0.5)] },
    syringe: { g: 'drug', zh: '注射', en: 'Injection', d: () => [R(5, 9.5, 11, 5, 1), L([16, 12], [20.5, 12]), L([20.5, 9.5], [20.5, 14.5]), L([16, 8.5], [16, 15.5]), L([5, 12], [1.5, 12]), L([8, 9.5], [8, 11.5]), L([10.5, 9.5], [10.5, 11.5]), L([13, 9.5], [13, 11.5])] },
    vaccine: { g: 'drug', zh: '疫苗', en: 'Vaccine', d: () => [R(8, 2, 8, 3, 1), R(9, 5, 6, 2), R(7, 7, 10, 14, 2), L([7, 13], [17, 13])] },
    iv: { g: 'drug', zh: '點滴', en: 'IV drip', d: () => [R(7, 2.5, 10, 12, 2.5), L([9.5, 7], [14.5, 7]), L([12, 14.5], [12, 17]), R(10.5, 17, 3, 3, 1), L([12, 20], [12, 22.5])] },
    inhaler: { g: 'drug', zh: '吸入劑', en: 'Inhaler', d: () => [R(10, 2.5, 6, 13, 2), R(4, 13.5, 12, 6, 2), L([3, 15], [1, 14]), L([3, 16.5], [1, 16.5]), L([3, 18], [1, 19])] },
    drops: { g: 'drug', zh: '滴劑', en: 'Drops', d: () => [R(13, 2, 5, 6, 2.5), S([[14, 8], [17, 8], [16, 16.5], [15, 16.5]]), S(smooth([[15.5, 18], [17, 20.5], [15.5, 22.5], [14, 20.5]]))] },
    patch: { g: 'drug', zh: '貼片', en: 'Patch', d: () => [R(4, 6, 16, 12, 3), R(8, 9, 8, 6, 1), C(6, 8, 0.6, true), C(18, 8, 0.6, true), C(6, 16, 0.6, true), C(18, 16, 0.6, true)] },
    // body
    heart: { g: 'body', zh: '心臟', en: 'Heart', d: () => [heart()] },
    kidney: { g: 'body', zh: '腎臟', en: 'Kidney', d: () => [S(smooth([[11, 3], [16.5, 5.5], [18.5, 12], [16, 19], [11, 21.5], [7, 19.5], [6.5, 15.5], [9.5, 12], [7, 8.5], [7.5, 4.8]])), L([9.5, 12], [13, 12])] },
    lungs: { g: 'body', zh: '肺', en: 'Lungs', d: () => [S(smooth([[10.5, 7], [7, 6], [3.5, 11], [3, 18], [5, 20.5], [10, 19], [10.5, 12]])), S(smooth([[13.5, 7], [17, 6], [20.5, 11], [21, 18], [19, 20.5], [14, 19], [13.5, 12]])), L([12, 2], [12, 10]), L([10.5, 12], [12, 10], [13.5, 12])] },
    brain: { g: 'body', zh: '腦', en: 'Brain', d: () => [S(smooth([[12, 4], [15.5, 3.5], [18.5, 5.5], [20.5, 9], [20, 13], [18.5, 16.5], [15, 18.5], [12, 18], [9, 18.5], [5.5, 16.5], [4, 13], [3.5, 9], [5.5, 5.5], [8.5, 3.5]])), L([12, 4], [12, 18]), LP(smooth([[7, 8], [9.5, 9.5], [8.5, 12.5]], false)), LP(smooth([[17, 8], [14.5, 9.5], [15.5, 12.5]], false)), L([12, 18], [13, 21])] },
    liver: { g: 'body', zh: '肝臟', en: 'Liver', d: () => [S(smooth([[2.5, 9], [8, 5.5], [15, 5], [21.5, 6.5], [20, 10], [14, 15.5], [8, 18.5], [4, 16]]))] },
    stomach: { g: 'body', zh: '胃', en: 'Stomach', d: () => [S(smooth([[9, 2], [11, 2], [11, 6], [15, 7], [19, 10], [19.5, 15], [16, 20], [10, 21], [6, 19], [5.5, 16], [8.5, 16.5], [12, 15], [11, 11], [9, 8]]))] },
    bone: { g: 'body', zh: '骨骼', en: 'Bone', d: () => [L([7, 10.5], [17, 10.5]), L([7, 13.5], [17, 13.5]), LP(arc(5.5, 9.6, 2.2, 2.2, 20, 270)), LP(arc(5.5, 14.4, 2.2, 2.2, 90, 340)), LP(arc(18.5, 9.6, 2.2, 2.2, -90, 160)), LP(arc(18.5, 14.4, 2.2, 2.2, 200, 450))] },
    eye: { g: 'body', zh: '眼睛', en: 'Eye', d: () => [S(smooth([[2, 12], [7, 7], [12, 5.5], [17, 7], [22, 12], [17, 17], [12, 18.5], [7, 17]])), C(12, 12, 3.5), C(12, 12, 1.2, true)] },
    blood: { g: 'body', zh: '血液', en: 'Blood', d: () => [S([[12, 2.5], ...smooth([[15.5, 8.5], [18, 13.5], [17, 18.5], [12, 21.5], [7, 18.5], [6, 13.5], [8.5, 8.5]], false)])] },
    dna: { g: 'body', zh: '基因', en: 'Genetics', d: () => { const a = helix(1), b = helix(-1); return [LP(a), LP(b), ...[3, 6, 9, 15, 18, 21].map((i) => L(a[i], b[i]))]; } },
    virus: { g: 'body', zh: '病毒', en: 'Virus', d: () => [C(12, 12, 5.5), ...[0, 45, 90, 135, 180, 225, 270, 315].flatMap((a) => [L(pt(12, 12, 5.5, 5.5, a), pt(12, 12, 8.3, 8.3, a)), C(...pt(12, 12, 9.2, 9.2, a), 0.9, true)])] },
    bacteria: { g: 'body', zh: '細菌', en: 'Bacteria', d: () => [R(4, 8, 16, 8, 4), C(9, 12, 0.9, true), C(13, 11, 0.9, true), C(15.5, 13, 0.9, true), LP(smooth([[20, 12], [21.5, 10], [23, 12]], false)), LP(smooth([[4, 12], [2.5, 14], [1, 12]], false))] },
    // care
    hospital: { g: 'care', zh: '醫院', en: 'Hospital', d: () => [R(4, 5, 16, 16, 1), R(10, 15, 4, 6), ...cross(12, 10, 2.5)] },
    clinic: { g: 'care', zh: '診所', en: 'Clinic', d: () => [L([2, 11], [12, 3], [22, 11]), L([5, 9], [5, 21], [19, 21], [19, 9]), ...cross(12, 14.5, 2.5)] },
    stethoscope: { g: 'care', zh: '聽診器', en: 'Stethoscope', d: () => [L([7, 2.5], [7, 9]), L([15, 2.5], [15, 9]), LP(arc(11, 9, 4, 4, 0, 180)), LP(smooth([[11, 13], [11, 17], [13, 20], [16.5, 19]], false)), C(18.5, 17.2, 2.4)] },
    thermometer: { g: 'care', zh: '體溫', en: 'Temperature', d: () => [R(10, 2.5, 4, 13, 2), C(12, 18, 3.2), L([14, 6], [16, 6]), L([14, 9], [16, 9]), L([14, 12], [16, 12]), L([12, 10], [12, 16])] },
    ambulance: { g: 'care', zh: '救護車', en: 'Emergency', d: () => [R(2, 8, 13, 9, 1), S([[15, 11], [19, 11], [22, 14], [22, 17], [15, 17]]), C(6, 18, 2), C(18, 18, 2), ...cross(8.5, 12.5, 2)] },
    gauge: { g: 'care', zh: '血壓', en: 'Blood pressure', d: () => [LP(arc(12, 15, 9, 9, 180, 360)), L([3, 15], [21, 15]), L([12, 15], [16.5, 8.5]), C(12, 15, 1.2, true)] },
    glucose: { g: 'care', zh: '血糖', en: 'Glucose', d: () => [R(6, 3, 12, 17, 2.5), R(8.5, 6, 7, 5, 1), C(12, 15.5, 1.8), L([12, 20], [12, 23])] },
    // research and data
    database: { g: 'data', zh: '資料庫', en: 'Database', d: () => [S(arc(12, 6, 7, 2.5, 0, 360, 24)), L([5, 6], [5, 18]), L([19, 6], [19, 18]), LP(arc(12, 18, 7, 2.5, 0, 180)), LP(arc(12, 12, 7, 2.5, 0, 180))] },
    bars: { g: 'data', zh: '長條圖', en: 'Bar chart', d: () => [L([3, 3], [3, 21], [21, 21]), R(6, 13, 3, 8), R(11, 9, 3, 12), R(16, 5, 3, 16)] },
    rise: { g: 'data', zh: '上升', en: 'Increase', d: () => [L([3, 3], [3, 21], [21, 21]), L([5, 17], [9.5, 12.5], [13, 15], [20, 7]), L([16, 7], [20, 7], [20, 11])] },
    fall: { g: 'data', zh: '下降', en: 'Decrease', d: () => [L([3, 3], [3, 21], [21, 21]), L([5, 7], [9.5, 11.5], [13, 9], [20, 17]), L([16, 17], [20, 17], [20, 13])] },
    calendar: { g: 'data', zh: '日期', en: 'Calendar', d: () => [R(3, 5, 18, 16, 2), L([3, 10], [21, 10]), L([8, 3], [8, 7]), L([16, 3], [16, 7]), R(7, 13, 2, 2, 0, true), R(11, 13, 2, 2, 0, true), R(15, 13, 2, 2, 0, true), R(7, 17, 2, 2, 0, true)] },
    clock: { g: 'data', zh: '時間', en: 'Time', d: () => [C(12, 12, 9), L([12, 6.5], [12, 12], [16, 14])] },
    document: { g: 'data', zh: '文件', en: 'Document', d: () => [S([[6, 2.5], [14, 2.5], [19, 7.5], [19, 21.5], [6, 21.5]]), L([14, 2.5], [14, 7.5], [19, 7.5]), L([9, 12], [16, 12]), L([9, 15], [16, 15]), L([9, 18], [14, 18])] },
    search: { g: 'data', zh: '搜尋', en: 'Search', d: () => [C(10.5, 10.5, 6.5), L([15.3, 15.3], [21, 21])] },
    filter: { g: 'data', zh: '篩選', en: 'Selection', d: () => [S([[3, 4], [21, 4], [14, 12], [14, 20], [10, 22], [10, 12]])] },
    link: { g: 'data', zh: '資料串連', en: 'Data linkage', d: () => [R(2.5, 8.5, 11, 7, 3.5), R(10.5, 8.5, 11, 7, 3.5)] },
    globe: { g: 'data', zh: '地區', en: 'Region', d: () => [C(12, 12, 9), S(arc(12, 12, 4, 9, 0, 360, 24)), L([3, 12], [21, 12]), L([4.5, 7.5], [19.5, 7.5]), L([4.5, 16.5], [19.5, 16.5])] },
    pin: { g: 'data', zh: '地點', en: 'Location', d: () => [S([[12, 22], ...smooth([[6.5, 13.5], [6, 9], [8.5, 4.5], [12, 3], [15.5, 4.5], [18, 9], [17.5, 13.5]], false)]), C(12, 9.5, 2.5)] },
    shield: { g: 'data', zh: '安全性', en: 'Safety', d: () => [S([[12, 2.5], [20, 5.5], [19.5, 12], [16, 18], [12, 21.5], [8, 18], [4.5, 12], [4, 5.5]]), L([8.5, 12], [11, 14.5], [15.5, 9.5])] },
    balance: { g: 'data', zh: '比較', en: 'Comparison', d: () => [L([12, 3], [12, 20]), L([7, 21], [17, 21]), L([4, 6], [20, 6]), L([4, 6], [2, 12.5]), L([4, 6], [6, 12.5]), LP(arc(4, 12.5, 2, 1.6, 0, 180)), L([20, 6], [18, 12.5]), L([20, 6], [22, 12.5]), LP(arc(20, 12.5, 2, 1.6, 0, 180))] },
    flask: { g: 'data', zh: '試驗', en: 'Experiment', d: () => [S([[9.5, 2.5], [14.5, 2.5], [14.5, 9], [20, 19], [19, 21.5], [5, 21.5], [4, 19], [9.5, 9]]), L([6.5, 15.5], [17.5, 15.5]), L([8.5, 2.5], [15.5, 2.5])] },
    microscope: { g: 'data', zh: '顯微鏡', en: 'Laboratory', d: () => [L([5, 21], [19, 21]), S([[8.5, 3], [11.5, 2], [15, 11], [12, 12]]), L([9, 15.5], [16, 15.5]), LP(smooth([[13, 12.5], [17.5, 13], [17.5, 18], [14, 21]], false))] },
    check: { g: 'data', zh: '確認', en: 'Confirmed', d: () => [C(12, 12, 9), L([7.5, 12.5], [10.5, 15.5], [16.5, 9])] },
    warning: { g: 'data', zh: '風險', en: 'Risk', d: () => [S([[12, 3], [22, 20.5], [2, 20.5]]), L([12, 9], [12, 14]), C(12, 17, 0.9, true)] },
    cost: { g: 'data', zh: '費用', en: 'Cost', d: () => [C(12, 12, 9), L([14.5, 8.5], [11, 8.5], [9.5, 10], [11, 12], [13, 12], [14.5, 14], [13, 15.5], [9.5, 15.5]), L([12, 6.5], [12, 17.5])] },
  };
  const GROUPS = [['people', '人物', 'People'], ['drug', '藥品', 'Medicines'], ['body', '身體', 'Body'], ['care', '醫療照護', 'Care'], ['data', '研究與數據', 'Research and data']];

  // draws an icon at (x, y), size × size, in one colour; sw is the line width (default scales with the size)
  RT.medIcon = (id, x, y, size, color, o = {}) => {
    const ic = ICONS[id]; if (!ic) return '';
    const k = size / 24, sw = o.sw || Math.max(1.1, size / 13), P = (p) => [x + p[0] * k, y + p[1] * k];
    return ic.d().map((op) => {
      if (op.t === 'l') return RT.line(op.pts.map(P), { color, sw });
      if (op.t === 's') return RT.poly(op.pts.map(P), { fill: op.fill ? color : 'none', stroke: color, sw });
      if (op.t === 'c') return RT.circle(x + op.cx * k, y + op.cy * k, op.r * k, op.fill ? { fill: color } : { stroke: color, sw });
      return RT.rect(x + op.x * k, y + op.y * k, op.w * k, op.h * k, op.fill ? { fill: color, radius: op.r * k } : { stroke: color, sw, radius: op.r * k });
    }).join('');
  };
  RT.medIcons = ICONS;
  RT.medIconGroups = GROUPS;
})();
