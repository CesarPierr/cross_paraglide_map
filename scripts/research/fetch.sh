#!/bin/bash
# usage: fetch.sh url outfile  -> saves html and text
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
curl -sSL -m 40 -A "$UA" -o "$2" -w "%{http_code} %{size_download} $1\n" "$1"
