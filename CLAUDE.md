# CLAUDE.md — Zasady współpracy w projekcie Typerek

## Workflow git

- Po zakończeniu każdego etapu pracy robimy commit na branch `main` i od razu pushujemy do GitHub.
- Commit tylko na `main` — nie tworzymy osobnych branchy, chyba że użytkownik wyraźnie poprosi.
- Wiadomość commita: zwięzła, po polsku lub angielsku, opisuje co zostało zrobione.
- Nie commitujemy niezakończonej pracy — każdy commit powinien być działającym stanem projektu.
- Format commita:

```
git commit -m "$(cat <<'EOF'
Opis zmian

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push origin main
```

## Ogólne zasady

- Nie tworzymy zbędnych plików dokumentacji ani komentarzy w kodzie.
- Kod powinien być czysty i minimalny — bez niepotrzebnych abstrakcji.
- Pytamy użytkownika przed ryzykownymi lub nieodwracalnymi operacjami.
