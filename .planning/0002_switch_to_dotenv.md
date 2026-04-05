# Planning: Switch to python-dotenv

Currently, the project uses `django-environ`. Based on the USER's request to "make use of dotenv", I will transition to `python-dotenv` for environment variable management.

## 1. Update Dependencies
- Add `python-dotenv` to `requirements.txt`.
- Keep `django-environ` for now to avoid breaking existing `DATABASES` and `ELASTICSEARCH` (if any), OR migrate fully. Given the user's rule for Django viewsets and serializers, they likely want a professional setup.

## 2. Update `config/settings.py`
- Import `load_dotenv` from `dotenv`.
- Move the env loading to the top of the file.
- Replace `django-environ` usage with standard `os.getenv`.

## 3. Update `config/celery.py`
- Ensure Celery also loads the `.env` file since it runs outside the main Django process in some contexts.

## 4. Verification
- Verify the CSRF settings are still reading correctly from the environment.
- Confirm the `DATABASE_URL` is still parsed correctly. Note that `django-environ`'s `env.db()` is very useful, so I might keep `django-environ` for the *parsing* but use `dotenv` for the *loading*.
