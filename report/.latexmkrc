# latexmk config for ntu-water-map report
# 強制使用 xelatex（本檔案需要 fontspec + xeCJK + 思源宋體 TW）

$pdf_mode = 5;          # 5 = xelatex
$xelatex  = 'xelatex -interaction=nonstopmode -synctex=1 %O %S';
$pdflatex = 'xelatex -interaction=nonstopmode -synctex=1 %O %S';
$bibtex_use = 2;        # bibtex 必要時自動跑
$out_dir = '.';
