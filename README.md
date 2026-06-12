# Sliding Puzzle

Ung dung xep hinh chay bang HTML/CSS/JavaScript thuan.

## Chay local

Mo truc tiep `index.html` trong trinh duyet, hoac dung web server tinh.

Neu da co Python:

```bash
python -m http.server 8000
```

Mo:

```txt
http://127.0.0.1:8000/
http://127.0.0.1:8000/play
http://127.0.0.1:8000/settings
```

## Deploy len Vercel

App nay la static site, Vercel chi can deploy thu muc goc repo.

1. Dua code len GitHub
2. Import repo vao Vercel
3. Framework Preset: `Other`
4. Root Directory: de mac dinh
5. Deploy

Chi tiet nam trong `DEPLOY.md`.

## Supabase

Ban nay khong can Supabase de chay.

Neu muon mo rong de luu du lieu dung chung tren web, xem:

```txt
supabase/setup.sql
```
