# Marcas (cuentas de Enzo)

Cada carpeta es una cuenta que Enzo maneja como si fuera un cliente de agencia.

```
marcas/
  coworkia/
    brand.json        ← lineamientos: colores, tono, público, servicios, qué no hacer
    logo-blanco.png   ← logo para fondos oscuros (PNG transparente)
    logo-oscuro.png   ← logo para fondos claros (PNG transparente)
```

- Enzo lee `brand.json` cada vez que crea un arte: si cambias un color, un precio o el tono,
  el siguiente arte ya sale con el cambio.
- Para una cuenta nueva copia la carpeta `coworkia`, cambia `slug`, textos, colores y logos,
  y pídele a Enzo: `@enzo arte para <slug> sobre ...`.
