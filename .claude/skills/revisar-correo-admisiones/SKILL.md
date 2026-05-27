---
name: revisar-correo-admisiones
description: >-
  Usar cuando Nora (o el equipo de Admisiones FWD) pida revisar, leer, buscar o
  resumir correos de su Gmail relacionados con el proceso de admisiones —
  respuestas de candidatos, rebotes de email (mailer-daemon), confirmaciones de
  entrevista, o el estado de los correos automáticos que envía el sistema. Se
  apoya en el conector MCP de Gmail ya conectado a Claude Code. Disparadores
  típicos: "revisá mi correo", "¿respondió algún candidato?", "buscá los rebotes",
  "¿llegó el correo de aceptación?", "mostrame los correos de admisiones".
---

# Revisar correo de Admisiones FWD

Esta skill le permite a Claude **leer y buscar el correo de Gmail** de la cuenta
institucional `nfigueroa@fwdcostarica.com` usando el **conector MCP de Gmail**
que ya está conectado a Claude Code.

## Qué puede hacer Claude con esta skill

- **Leer** correos del inbox (mensajes individuales y completos)
- **Buscar** correos por remitente, asunto, fecha o estado (leído/sin leer)
- **Resumir** hilos largos de conversación con candidatos
- **Detectar rebotes** (mensajes de `mailer-daemon@googlemail.com`) que indican
  emails no entregados a candidatos
- **Etiquetar** correos (ej. marcar candidatos) si se solicita
- **Redactar borradores** de respuesta (no se envían solos; quedan como borrador)

> **Importante:** este conector es para que **Claude asista a Nora** leyendo su
> correo. Es distinto del envío automático del sistema de admisiones, que usa
> SMTP de Gmail (`nfigueroa@fwdcostarica.com` + App Password) configurado en
> `server/.env`. Son dos cosas separadas.

## Cómo usar el conector (herramientas MCP disponibles)

El conector de Gmail expone estas herramientas. Si no están cargadas, primero
hay que cargarlas con `ToolSearch` (query `select:<nombre>` o por palabra clave
"gmail"):

| Herramienta | Para qué sirve |
|---|---|
| `search_threads` | Buscar hilos con sintaxis de búsqueda de Gmail |
| `get_thread` | Leer el contenido completo de un hilo (usar `FULL_CONTENT`) |
| `list_labels` | Listar etiquetas del usuario (para obtener sus IDs) |
| `label_thread` / `unlabel_thread` | Etiquetar / quitar etiqueta a un hilo |
| `create_draft` | Crear un borrador de respuesta |

## Sintaxis de búsqueda útil (Gmail query)

`search_threads` recibe queries en sintaxis de Gmail. Ejemplos para admisiones:

- **Correos recientes del inbox:** `in:inbox newer_than:7d`
- **Rebotes / no entregados:** `from:mailer-daemon@googlemail.com`
- **Respuestas de candidatos:** `in:inbox -from:nfigueroa@fwdcostarica.com newer_than:14d`
- **Sin leer:** `is:unread in:inbox`
- **De un candidato específico:** `from:juan.perez@gmail.com`
- **Correos que mandó el sistema:** `from:nfigueroa@fwdcostarica.com subject:"FWD Costa Rica"`
- **Confirmaciones de entrevista:** `subject:entrevista newer_than:30d`

## Flujo recomendado

1. **Buscar** con `search_threads` usando una query acotada (limitar con
   `newer_than:` y `pageSize` razonable, ej. 10-20).
2. **Leer el detalle** con `get_thread` (formato `FULL_CONTENT`) solo de los
   hilos relevantes — no traer todo el contenido de entrada.
3. **Resumir a Nora** en español, claro y conciso: quién escribió, qué pide,
   y qué acción se sugiere.
4. Si Nora pide responder, **crear un borrador** con `create_draft` y avisar que
   quedó como borrador para que ella lo revise antes de enviar.

## Casos de uso típicos en admisiones

- *"¿Respondió algún candidato esta semana?"* → buscar respuestas entrantes
  recientes, resumir cada una.
- *"¿Se entregaron los correos de aceptación?"* → buscar rebotes; si hay
  `mailer-daemon`, identificar a qué candidato no le llegó y avisar.
- *"Resumime la conversación con [candidato]"* → buscar por su email, leer el
  hilo completo, resumir.
- *"Marcá como importante los correos de candidatos sin responder"* → buscar y
  etiquetar.

## Privacidad y límites

- Claude **solo lee lo que Nora le pide** y muestra cada acción en la
  conversación (auditable).
- Nora puede **revocar** el acceso cuando quiera con `/mcp` → Gmail →
  "Clear authentication", o desde https://myaccount.google.com/permissions
- Esta skill **no envía** correos automáticamente — como máximo crea borradores.
