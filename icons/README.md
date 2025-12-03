# アイコンファイルについて

このフォルダには以下のアイコンファイルを配置してください:

- `icon16.png` (16x16ピクセル)
- `icon48.png` (48x48ピクセル)
- `icon128.png` (128x128ピクセル)

## アイコン作成のヒント

1. オンラインツール（例: Canva, Figma）でYouTubeのライブチャット関連のアイコンをデザイン
2. 3つのサイズでエクスポート
3. このフォルダに配置

## 一時的な対応

現在、拡張機能は動作しますが、アイコンファイルがないため、Chromeのデフォルトアイコンが表示されます。
上記のファイルを追加することで、カスタムアイコンが表示されるようになります。

### クイックスタート用のコマンド例

以下のコマンドで簡単な赤いアイコンを生成できます（ImageMagickが必要）:

```bash
# 16x16
convert -size 16x16 xc:red -font Arial -pointsize 10 -fill white -gravity center -annotate +0+0 "YT" icons/icon16.png

# 48x48
convert -size 48x48 xc:red -font Arial -pointsize 30 -fill white -gravity center -annotate +0+0 "YT" icons/icon48.png

# 128x128
convert -size 128x128 xc:red -font Arial -pointsize 80 -fill white -gravity center -annotate +0+0 "YT" icons/icon128.png
```
