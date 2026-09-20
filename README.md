# ドルトク (dorutoku.com)

在米日本人向けのお得情報サイト。Instagram (@dorutoku) からの導線を受ける置き場。

**このリポジトリの中身は手で書きません。** `docs/` は丸ごと生成物です。
中身の正は台帳とカタログで、生成するのは tiny-pulse の `deals_export.py` です。

## 構成
| 置き場 | 中身 |
|---|---|
| `docs/` | GitHub Pages が出すもの(毎回まるごと作り直し) |
| `docs/CNAME` | `dorutoku.com` |
| `docs/index.html` | 今週のお得(上位40件・80KB以下) |
| `docs/more.json` | 残りと単品(「もっと見る」が読む) |
| `docs/cards/` | カードの基礎知識 + 知っておくこと |
| `docs/articles/` | 読みもの(published の記事だけ) |
| `docs/scene/` | 場面別の全件(外食・食料品・子ども・無料・服くつ) |
| `docs/ig/` | Instagram からの入口(canonical は `/`) |
| `docs/sitemap.xml` / `robots.txt` | 生成 |

## 更新のしかた
```
python3 ~/tiny-pulse/deals_export.py      # docs/ を作り直す
cd ~/repos/dorutoku && git add -A && git commit -m "..." && git push
```
書き出しは公開してはいけない語(手元の環境の名前・保有カードの記録・記事の一人称の保有表現)を
機械で検査し、1件でも見つかればビルドを失敗させます。通らなければ push しないでください。

## 決まりごと
- 掲載順は決定的なルールコードだけで決めます。提携による報酬額では変えません(CFPB Circular 2024-01)。
- 広告の開示(FTC 16 CFR Part 255)は1か所の設定から全ページの上部に出します。記事本文には書きません。
- 個人の保有カード・Offers・プロフィールの州以外の項目は、このサイトに一切出しません。

運営: PlugBits ／発信名義: オケオ
