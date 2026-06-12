# Deploy len Vercel, Supabase va Git

## 1. Git cục bộ

Khoi tao repo:

```bash
git init
git add .
git commit -m "Prepare sliding puzzle for deployment"
git branch -M main
```

Gan remote GitHub va day code:

```bash
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## 2. Vercel

- Dang nhap Vercel bang GitHub
- Chon `Add New Project`
- Chon repo nay
- Framework Preset: `Other`
- Root Directory: de mac dinh
- Production Branch: `main`

App nay dung `vercel.json` de rewrite:

- `/` -> `index.html`
- `/play` -> `index.html`
- `/settings` -> `index.html`

## 3. Supabase

Ban hien tai khong can Supabase de chay vi:

- app la static
- anh upload dang luu local trong `IndexedDB`
- khong co backend doc/ghi du lieu dung chung

Neu muon chuan bi san project Supabase giong cach to chuc cua `vqmm`, chay SQL trong:

```txt
supabase/setup.sql
```

SQL nay tao bang metadata/co so de sau nay mo rong luu:

- cau hinh dung chung
- bo anh dung chung
- thong ke luot choi

Luu y: hien tai source code chua goi Supabase API, nen buoc nay la `optional`.

## 4. Chay local

Mo truc tiep `index.html`, hoac:

```bash
python -m http.server 8000
```

## 5. Link sau khi deploy

```txt
https://your-project.vercel.app/
https://your-project.vercel.app/play
https://your-project.vercel.app/settings
```
