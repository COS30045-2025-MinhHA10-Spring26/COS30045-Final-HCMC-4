"""
One-off migration script used to patch script.js with label-relaxation logic
for slope charts. Already applied; kept for reference only.

Usage (from repo root):
  python3 scripts/fix_slope.py [--input script.js] [--output script.js]
"""

import argparse
import re


def replace_slope(match):
    original = match.group(0)

    original = re.sub(r'width = 700, height = 300', r'width = 700, height = 450', original)
    original = re.sub(r'svg.style.height = "300px"', r'svg.style.height = "450px"', original)

    relax_logic = """
  const leftY = {};
  const rightY = {};
  const lArr = pairs.map(p => ({ j: p.jurisdiction, y: yPos(p.first) })).sort((a,b) => a.y - b.y);
  const rArr = pairs.map(p => ({ j: p.jurisdiction, y: yPos(p.second) })).sort((a,b) => a.y - b.y);
  const relax = (arr) => {
    for(let k=0; k<15; k++) {
      for(let i=0; i<arr.length-1; i++) {
        if (arr[i+1].y - arr[i].y < 14) {
          const shift = (14 - (arr[i+1].y - arr[i].y)) / 2;
          arr[i].y -= shift;
          arr[i+1].y += shift;
        }
      }
    }
  };
  relax(lArr); relax(rArr);
  lArr.forEach(item => leftY[item.j] = item.y);
  rArr.forEach(item => rightY[item.j] = item.y);

  let markup ="""
    original = re.sub(r'  let markup =', relax_logic, original)

    original = re.sub(
        r'<text x="\$\{pad\.left - 8\}" y="\$\{y1 \+ 4\}" text-anchor="end" font-size="11" fill="#f1f5f9" font-weight="600">\$\{p\.jurisdiction\}</text>',
        r'<text x="${pad.left - 8}" y="${leftY[p.jurisdiction] + 4}" text-anchor="end" font-size="11" fill="#f1f5f9" font-weight="600">${p.jurisdiction}</text>',
        original,
    )

    original = re.sub(
        r'<text x="\$\{pad\.left \+ innerW \+ 8\}" y="\$\{y2 \+ 4\}" font-size="10" fill="\$\{rising \? \'#34d399\' : \'#f87171\'\}">\$\{fmtCompact\(Math\.round\(p\.second\)\)\} \$\{rising \? \'↑\' : \'↓\'\}</text>',
        r'<text x="${pad.left + innerW + 8}" y="${rightY[p.jurisdiction] + 4}" font-size="10" fill="${rising ? \'#34d399\' : \'#f87171\'}">${fmtCompact(Math.round(p.second))} ${rising ? \'↑\' : \'↓\'}</text>',
        original,
    )

    return original


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", default="script.js", help="Source JS file")
    parser.add_argument("--output", default="script.patched.js", help="Output JS file")
    args = parser.parse_args()

    with open(args.input, "r") as f:
        content = f.read()

    new_content = re.sub(
        r'function draw(Fines|Breath|Drug)Slope\(records\) \{[\s\S]*?svg\.style\.width = "100%";\n\}',
        replace_slope,
        content,
    )

    with open(args.output, "w") as f:
        f.write(new_content)

    print(f"Written to {args.output}")


if __name__ == "__main__":
    main()
