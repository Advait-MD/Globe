<h1 align="center">
 🌍 News Globe
</h1>

<p align="center">
Interactive On-Globe news visualization platform .
</p>

<p align="center">
This project allows users to explore news through an immersive globe experience with their personalized news preferences.
</p>

---

## Live Demo

<div align="center">

### Frontend  
https://globe-mocha-eta.vercel.app/

### Backend API  
https://globe-2-i1ty.onrender.com

### Swagger Docs  
https://globe-2-i1ty.onrender.com/docs

Test credentials:
Test username: test1 ,
Test password: 1234

</div>

---

## Screenshots

<div align="center">

### Login Page

<img width="1918" height="967" alt="Screenshot 2026-05-18 082018" src="https://github.com/user-attachments/assets/8943b9ec-654c-48bd-92a9-2c09cf216507" />


<br/>
<br/>

### Signup Page

<img width="1918" height="971" alt="Screenshot 2026-05-18 082042" src="https://github.com/user-attachments/assets/b2b1c20c-4db2-4a04-b01d-da5eaa36fefa" />


<br/>
<br/>

### Globe Visualization

<img width="1917" height="967" alt="Screenshot 2026-05-18 081924" src="https://github.com/user-attachments/assets/4daa3135-631b-4a32-8494-7c230f4f4cc2" />


<br/>
<br/>

### Preference Page

<img width="1918" height="966" alt="Screenshot 2026-05-18 082202" src="https://github.com/user-attachments/assets/289c7707-f711-4c06-a305-1bbe6035fdd6" />


<br/>
<br/>

### Profile Setting

<img width="1918" height="968" alt="Screenshot 2026-05-18 081951" src="https://github.com/user-attachments/assets/a7009957-cc4b-4725-9bee-474eb727654f" />

---

## Running locally

**Backend** (Python 3.10+)
```bash
cd backend
pip install -r requirements-dev.txt
cp .env.example .env          # fill in API_KEY and JWT_SECRET
uvicorn server:app --reload   # http://localhost:8000/docs
python -m pytest              # run the test suite (SQLite)
TEST_DATABASE_URL=postgresql://localhost/globe_test python -m pytest   # ...or against Postgres (wipes that DB)
```

**Frontend**
```bash
cd frontend/Civ
pnpm install
echo "VITE_API_URL=http://localhost:8000" > .env.local
pnpm dev                      # http://localhost:5173
pnpm test                     # unit tests (Vitest)
```

### API & authentication
`/signup` and `/login` return a JWT (`access_token`). Every other endpoint requires
`Authorization: Bearer <token>` and acts only on the token's owner:

| Method | Path | Purpose |
|---|---|---|
| POST | `/signup` | Create account, returns token |
| POST | `/login` | Returns token + `hasPreference` |
| GET / POST | `/preference` | Read / update your news section |
| GET | `/news` | Latest stories for your section, with coordinates |
| DELETE | `/account` | Delete your account |

In Swagger (`/docs`), click **Authorize** and paste the token from `/login`.

### How `/news` stays fast
Everyone who picks the same section sees the same stories, so the located feed is
built once per section and cached for `FEED_TTL_SECONDS` (default 15 min); a lock
makes simultaneous requests wait for one build instead of repeating it. Place-name
coordinates are stored in the `geocode_cache` table, so restarts don't repeat the
1-request-per-second Nominatim lookups. If the Guardian API fails, the last good
feed is served.

---

## Lernings
<p align="left">
 Working with SQLite and SQLAlchemy.
 </br>
 Well modulated code writing approach.
 </br>
 Working with camera, scenes and rendering.
 </br>
 Efficient use of React states.
</p>
 
</div>

---
