# 第三者データ・ライブラリの出典

## 東日本大震災ツイートマッピング

配布元：https://github.com/wtnv-lab/tweetMapping

公開アーカイブ：https://tweet.mapping.jp/

投稿データの出典として利用しています。元の本文と座標を保持し、別の項目に人工時刻を追加しました。
以下は配布リポジトリのLICENSEです。これはソフトウェアの許諾表示であり、各投稿の著作権やデータのあらゆる再配布許可を独立に保証するものとは扱いません。

```text
Copyright 2021 Hidenori Watanave

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## 背景地図・地図ライブラリ

Mapbox GL JSとMapbox Darkを使用しています。地図上のMapboxおよび地図データ提供元の帰属表示を維持しています。

## 初期版のデータ

Helwig, N., Gao, Y., Wang, S., & Ma, P. (2015). Twitter Geospatial Data [Dataset]. UCI Machine Learning Repository.

https://doi.org/10.24432/C5RS5J

CC BY 4.0：https://creativecommons.org/licenses/by/4.0/

初期版では地域・日時の抽出、日時の変換、GeoJSON化を行いました。現在の震災デモで表示しているデータとは異なります。
