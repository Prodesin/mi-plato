#!/workspace/pwenv/bin/python
"""Comprobación en navegador (Chrome headless + playwright): sin desbordes, sin errores de consola y flujo funcional.
Uso: python3 -m http.server 8782 (en la carpeta del proyecto; 8781 estaba ocupado por otro servidor) y /workspace/pwenv/bin/python tools/check-ui.py"""
import json, os, sys, datetime, re
from playwright.sync_api import sync_playwright

URL = os.environ.get("MI_PLATO_URL", "http://localhost:8782/index.html")
OUT = "/workspace/mi-plato-capturas"
os.makedirs(OUT, exist_ok=True)
VIEWS = [("exterior", 466, 678), ("exterior", 678, 466), ("interior", 951, 669), ("interior", 669, 951), ("iphone", 390, 844)]
TABS = ["resumen", "hoy", "semana", "alimentos", "ajustes"]
fails = []
def meals_txt(page):
    """Las comidas son tarjetas compactas: abre todas para leer los alimentos."""
    for el in page.locator(".meal-compact__main").all():
        if not el.evaluate("e => !!e.parentElement.querySelector('.meal-compact__details')"): el.click(); page.wait_for_timeout(80)
    return page.inner_text(".meals")

def fail(m):
    fails.append(m); print("✗", m)

def seed(today):
    d = datetime.date.fromisoformat(today)
    def it(n, g, k, p, c, az, fi, gr, ig, cat, i):
        return {"id": f"s{i}{n[:3]}", "foodId": None, "nombre": n, "g": g, "por100": {"kcal": k, "p": p, "c": c, "az": az, "fi": fi, "gr": gr}, "ig": ig, "cat": cat, "fuente": "base"}
    meals = []
    n = 0
    for back in range(0, 6):
        day = (d - datetime.timedelta(days=back)).isoformat()
        n += 1
        meals.append({"id": f"m{n}", "fecha": day, "hora": "08:30", "toma": "desayuno", "texto": "", "items": [it("Pan blanco", 60, 258, 8.5, 53, 3, 2.5, 1.3, "alto", "pan", n), it("Café con leche", 200, 25, 1.6, 2.4, 2.4, 0, 1, "bajo", "bebida", n), it("Mermelada", 15, 250, .4, 62, 58, 1, .1, "alto", "dulce", n)]})
        n += 1
        meals.append({"id": f"m{n}", "fecha": day, "hora": "14:00", "toma": "comida", "texto": "", "items": [it("Lentejas estofadas", 300, 132, 8, 15, 1.5, 5, 4.5, "bajo", "plato", n), it("Pan blanco", 60, 258, 8.5, 53, 3, 2.5, 1.3, "alto", "pan", n), it("Manzana", 180, 51, .3, 12, 10.4, 2.4, .2, "bajo", "fruta", n)], "glucDespues": 150 + back * 8})
        n += 1
        meals.append({"id": f"m{n}", "fecha": day, "hora": "21:00", "toma": "cena", "texto": "", "items": [it("Pasta cocida", 250, 155, 5.8, 31, 1, 2, .9, "medio", "pasta", n), it("Tomate frito", 60, 82, 1.5, 10, 8, 1.5, 4, "bajo", "salsa", n)]})
    return meals

def run():
    today = datetime.date.today().isoformat()
    meals = seed(today)
    with sync_playwright() as p:
        br = p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True, args=["--no-sandbox"])
        # ---------- 1) Diseño: tamaños × claro/oscuro × pantallas ----------
        for scheme in ("light", "dark"):
            for kind, w, h in VIEWS:
                ctx = br.new_context(viewport={"width": w, "height": h}, color_scheme=scheme, has_touch=True, is_mobile=False, locale="es-ES")
                ctx.add_init_script("if(!localStorage.getItem('mi-plato:v1')){localStorage.setItem('mi-plato:v1', %s)}" % json.dumps(json.dumps({"schema": 1, "data": {"comidas": meals, "ajustes": {"usarIA": False, "proveedor": "anthropic", "modelos": {}, "atajo": "Enviar a Coco", "usarAtajo": False, "bienvenida": True}}})))
                page = ctx.new_page()
                errs = []
                page.on("console", lambda m, errs=errs: errs.append(m.text) if m.type == "error" else None)
                page.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
                page.goto(URL); page.wait_for_selector(".tabbar")
                if page.get_attribute("#tab-resumen", "aria-selected") != "true" or page.is_visible("#area-hoy"): fail(f"la primera pantalla debe ser el Resumen ({w}x{h})")
                suf = "-oscuro" if scheme == "dark" else ""
                tag = f"{kind}-{w}x{h}"
                def overflow(label):
                    sw = page.evaluate("document.documentElement.scrollWidth"); iw = page.evaluate("window.innerWidth")
                    if sw != iw: fail(f"desborde horizontal en {tag}{suf} {label}: scrollWidth {sw} != innerWidth {iw}")
                    bad = page.evaluate("""() => [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1) && getComputedStyle(e).position !== 'fixed' && !e.closest('svg') && !e.closest('[hidden]') && !e.closest('.sheet__scroll,.k-toast') }).slice(0,3).map(e => e.tagName + '.' + e.className)""")
                    if bad: fail(f"elementos fuera de pantalla en {tag}{suf} {label}: {bad}")
                for t in TABS:
                    page.click(f"#tab-{t}"); page.wait_for_timeout(350)
                    overflow(t)
                    if t == "resumen":
                        if w == 466 and h == 678 and page.evaluate("document.documentElement.scrollHeight") > h + 1: fail(f"el Resumen no cabe sin scroll en {tag}{suf}: {page.evaluate('document.documentElement.scrollHeight')} > {h}")
                        if page.evaluate("[...document.querySelectorAll('.res__acciones .k-btn, .res__foto, .res__ver')].some(e => e.getBoundingClientRect().height > 64)"): fail(f"botones del Resumen demasiado altos (>64 px) en {tag}{suf}")
                        if page.locator(".res__ring").count() != 1 or page.locator(".res__frase").count() != 1 or "Añadir comida" not in page.inner_text(".res__acciones"): fail(f"al Resumen le falta el anillo, la frase o «Añadir comida» en {tag}{suf}")
                    if t == "hoy":
                        if page.evaluate("getComputedStyle(document.querySelector('textarea[aria-label=\"¿Qué estás comiendo?\"]')).resize") != "none": fail(f"la caja de texto aún se puede redimensionar en {tag}{suf}")
                        if page.evaluate("(() => { const e = document.querySelector('.apple-date'); const lh = parseFloat(getComputedStyle(e).lineHeight) || 20; return e.getBoundingClientRect().height > lh * 1.6 })()"): fail(f"la fecha de Hoy baja a dos líneas en {tag}{suf}")
                    if t == "hoy" or scheme == "light" or True:
                        page.screenshot(path=f"{OUT}/{tag}-{t}{suf}.png")
                # revisión abierta con una comida analizada
                page.click("#tab-hoy")
                page.fill("textarea", "dos huevos, una tostada de pan integral y café con leche")
                page.click("text=Corregir mi comida"); page.wait_for_selector(".sheet"); page.wait_for_timeout(300)
                overflow("revision")
                # selector de raciones: visible, sin desbordar y con botones de al menos 44 px
                if page.locator(".rac").count() < 3: fail(f"faltan selectores de raciones en {tag}{suf}")
                bad = page.evaluate("""() => [...document.querySelectorAll('.sheet .rac, .sheet .rac *, .sheet .item-row__top *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 0.5 || r.left < -0.5) }).slice(0,3).map(e => e.className)""")
                if bad: fail(f"el selector de raciones se sale de la pantalla en {tag}{suf}: {bad}")
                chicos = page.evaluate("""() => [...document.querySelectorAll('.sheet .rac__b, .sheet .rac__chip')].filter(e => { const r = e.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5 }).length""")
                if chicos: fail(f"{chicos} botones de ración de menos de 44 px en {tag}{suf}")
                if page.evaluate("(() => { const e = document.querySelector('.sheet__scroll'); return e.scrollWidth > e.clientWidth + 1 })()"): fail(f"la hoja de revisión desborda en horizontal en {tag}{suf}")
                page.screenshot(path=f"{OUT}/{tag}-revision{suf}.png")
                # girar/plegar sin perder la revisión: cambia el tamaño y comprueba que sigue abierta con el texto
                page.set_viewport_size({"width": h, "height": w}); page.wait_for_timeout(250)
                if not page.query_selector(".sheet"): fail(f"se pierde la revisión al cambiar de tamaño en {tag}")
                page.set_viewport_size({"width": w, "height": h}); page.wait_for_timeout(200)
                page.click(".sheet__foot >> text=Cancelar"); page.wait_for_timeout(200)
                if page.input_value("textarea") == "": fail(f"se pierde el texto escrito en {tag}")
                errs = [e for e in errs if "Failed to load resource" not in e]
                if errs: fail(f"errores de consola en {tag}{suf}: {errs[:3]}")
                ctx.close()
        # ---------- 2) Funcional (iPhone 390×844) ----------
        ctx = br.new_context(viewport={"width": 390, "height": 844}, locale="es-ES", accept_downloads=True)
        page = ctx.new_page()
        errs = []
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.goto(URL); page.wait_for_selector(".res")
        # Resumen vacío: estado amable con «Añadir comida»; al pulsarlo va a Hoy con la caja enfocada
        if "Empieza el día" not in page.inner_text(".res"): fail("el Resumen vacío debe decir «Empieza el día»")
        page.click(".res__acciones >> text=Añadir comida"); page.wait_for_selector(".welcome")
        if page.evaluate("document.activeElement && document.activeElement.getAttribute('aria-label')") != "¿Qué estás comiendo?": fail("«Añadir comida» debe dejar la caja de texto enfocada")
        # bienvenida con 3 ejemplos
        if page.locator(".ejemplos button").count() != 3: fail("la bienvenida debe tener 3 ejemplos clicables")
        page.fill("textarea", "dos huevos, una tostada de pan integral y café con leche")
        page.click("text=Corregir mi comida"); page.wait_for_selector(".sheet")
        txt = page.inner_text(".sheet")
        for esperado in ["Huevo", "Pan integral", "Café con leche"]:
            if esperado not in txt: fail(f"el análisis no incluye {esperado}")
        if not page.query_selector(".corr"): fail("no hay correcciones en la revisión")
        n0 = page.locator(".item-row").count()
        # raciones fáciles: chip «2» sobre el primer alimento («Huevo») y comprobar que se recalcula con ración casera
        before = page.inner_text(".k-metrics.tight")
        fila = page.locator(".item-row").first
        if "huevo" not in fila.locator(".rac__txt").inner_text().lower(): fail("la ración del huevo debería decir huevo(s): " + fila.locator(".rac__txt").inner_text())
        fila.locator(".rac__chip", has_text="3").click(); page.wait_for_timeout(150)
        after = page.inner_text(".k-metrics.tight")
        if before == after: fail("las cifras no se recalculan al cambiar la ración")
        if not fila.locator(".rac__txt").inner_text().startswith("3 huevos"): fail("tras el chip 3 debe poner «3 huevos»: " + fila.locator(".rac__txt").inner_text())
        fila.locator(".rac__b", has_text="−").click(); page.wait_for_timeout(100)
        if not fila.locator(".rac__txt").inner_text().startswith("2 huevos"): fail("tras «−» debe poner «2 huevos»: " + fila.locator(".rac__txt").inner_text())
        fila.locator(".rac__b", has_text="+").click(); page.wait_for_timeout(100)
        if not fila.locator(".rac__txt").inner_text().startswith("3 huevos"): fail("tras «+» debe poner «3 huevos»")
        fila.locator(".rac__chip", has_text="½").click(); page.wait_for_timeout(100)
        if not fila.locator(".rac__txt").inner_text().startswith("½ huevo"): fail("el chip ½ debe poner «½ huevo»: " + fila.locator(".rac__txt").inner_text())
        # los gramos siguen como opción avanzada dentro del detalle
        fila.locator(".item-row__name").click(); page.wait_for_timeout(100)
        gin = fila.locator(".qty__in input")
        if gin.count() != 1 or gin.input_value() != "30": fail("el detalle debe tener los gramos editables (½ huevo = 30 g)")
        gin.fill("120"); page.wait_for_timeout(100)
        if not fila.locator(".rac__txt").inner_text().startswith("2 huevos"): fail("al cambiar los gramos a 120 debe verse «2 huevos»")
        page.click(".sheet__foot .k-btn--primary"); page.wait_for_timeout(300)
        if page.query_selector(".sheet"): fail("la revisión no se cierra al guardar")
        if "café con leche" not in meals_txt(page).lower(): fail("la comida guardada no aparece en Hoy")
        if page.input_value("textarea") != "": fail("el texto debería vaciarse al guardar")
        page.fill("textarea", "un plato de lentejas")
        page.click("text=Corregir mi comida"); page.wait_for_selector(".sheet")
        if not page.locator(".rac__txt").first.inner_text().startswith("1 plato"): fail("«un plato de lentejas» debería verse como «1 plato…»")
        page.locator(".item-row__name").first.click(); page.wait_for_timeout(100)
        if page.locator(".qty__in input").first.input_value() != "300": fail("«un plato de lentejas» debería ser 300 g en el detalle")
        page.click(".sheet__foot .k-btn--primary"); page.wait_for_timeout(300)
        page.screenshot(path=f"{OUT}/iphone-390x844-hoy-funcional.png", full_page=True)
        page.reload(); page.wait_for_selector(".tabbar"); page.click("#tab-hoy"); page.wait_for_selector(".meals")
        t = meals_txt(page)
        if "lentejas" not in t.lower() or "café con leche" not in t.lower(): fail("los datos no persisten tras recargar")
        # exportar / importar
        page.click("#tab-ajustes"); page.wait_for_timeout(200)
        with page.expect_download() as dl:
            page.click("text=Exportar copia")
        path = f"{OUT}/copia-prueba.json"; dl.value.save_as(path)
        data = json.load(open(path))
        if data.get("app") != "mi-plato" or len(data["data"].get("comidas", [])) < 2: fail("la exportación no contiene las comidas")
        if "secretos" in data: fail("la copia por defecto no debe incluir secretos")
        page.click("text=Borrar mis datos"); page.click(".k-dialog[open] .k-btn--danger"); page.wait_for_timeout(300)
        page.click("#tab-hoy"); page.wait_for_timeout(200)
        if page.query_selector(".meal"): fail("tras borrar no debería haber comidas")
        page.click("#tab-ajustes")
        page.set_input_files("input[type=file][accept*=json]", path); page.wait_for_selector(".k-dialog[open]")
        page.click(".k-dialog[open] .k-btn--danger"); page.wait_for_timeout(300)
        page.click("#tab-hoy"); page.wait_for_timeout(200)
        if "lentejas" not in meals_txt(page).lower(): fail("la importación no restaura las comidas")
        # importación inválida
        open(f"{OUT}/malo.json", "w").write('{"app":"otra","data":{}}')
        page.click("#tab-ajustes"); page.set_input_files("input[type=file][accept*=json]", f"{OUT}/malo.json"); page.wait_for_timeout(300)
        if "no es una copia de Mi plato" not in page.inner_text(".k-toast"): fail("la importación inválida debe avisar")
        # ---------- Gemini (respuestas simuladas): clave falsa, «Probar», foto del plato ----------
        mock = {"modo": "clave"}; gem_calls = []
        CORS = {"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*"}
        ANALISIS = {"items": [
            {"nombre": "Huevo", "gramos": 120, "kcal": 172, "proteina": 15, "hidratos": 1, "azucares": 0.5, "fibra": 0, "grasa": 12, "racion": "huevo", "raciones": 2, "ig": "bajo", "confianza": "alta"},
            {"nombre": "Tostada de pan integral", "gramos": 70, "kcal": 170, "proteina": 6, "hidratos": 30, "azucares": 2, "fibra": 4, "grasa": 2, "racion": "tostada", "raciones": 2, "ig": "medio", "confianza": "media"},
            {"nombre": "Guiso de la abuela", "gramos": 300, "kcal": 330, "proteina": 20, "hidratos": 25, "azucares": 3, "fibra": 5, "grasa": 14, "racion": "plato", "raciones": 1, "ig": "bajo", "confianza": "baja", "nota": "Lleva salsa"}],
            "correcciones": [{"tipo": "aviso", "texto": "Añade una ensalada para saciarte más."}], "resumen": "Desayuno potente."}
        def gem(route):
            req = route.request
            if req.method == "OPTIONS": return route.fulfill(status=204, headers=CORS)
            gem_calls.append({"url": req.url, "headers": req.headers, "body": req.post_data or ""})
            m = mock["modo"]
            if m == "clave": return route.fulfill(status=400, headers=CORS, content_type="application/json", body=json.dumps({"error": {"code": 400, "message": "API key not valid. Please pass a valid API key.", "status": "INVALID_ARGUMENT"}}))
            if m in ("429", "503"): return route.fulfill(status=int(m), headers=CORS, content_type="application/json", body="{}")
            if m == "offline": return route.abort()
            txt = '{"ok":true}' if '{\\"ok\\":true}' in (req.post_data or "") or '{"ok":true}' in (req.post_data or "") else json.dumps(ANALISIS)
            route.fulfill(status=200, headers=CORS, content_type="application/json", body=json.dumps({"candidates": [{"content": {"parts": [{"text": txt}]}}]}))
        ctx.route(re.compile(r"generativelanguage\.googleapis\.com"), gem)
        page.click("#tab-ajustes"); page.wait_for_timeout(200)
        if not page.is_visible("text=Consigue tu clave gratis") or page.get_attribute("a:has-text('Consigue tu clave gratis')", "href") != "https://aistudio.google.com/apikey": fail("falta el enlace «Consigue tu clave gratis»")
        if "La clave se guarda solo en este iPhone" not in page.inner_text("#area-ajustes"): fail("falta la nota de privacidad de la clave")
        if page.get_attribute("input[aria-label='Clave de Gemini']", "type") != "password": fail("la clave de Gemini debe ser de tipo contraseña")
        page.click(".ia-gemini >> text=Mostrar")
        if page.get_attribute("input[aria-label='Clave de Gemini']", "type") != "text": fail("«Mostrar» debe enseñar la clave")
        page.fill("input[aria-label='Clave de Gemini']", "AIza-falsa-123")
        page.click(".ia-gemini >> text=Probar"); page.wait_for_selector(".ia-estado")
        print("   «Probar» con clave falsa →", page.inner_text(".ia-estado"))
        if "clave de Gemini no es válida" not in page.inner_text(".ia-estado"): fail("«Probar» con clave falsa debe dar el error en llano")
        mock["modo"] = "ok"
        page.click(".ia-gemini >> text=Probar"); page.wait_for_function("document.querySelector('.ia-estado.ok')")
        if page.inner_text(".ia-estado") != "Funciona ✓": fail("«Probar» correcto debe decir «Funciona ✓»")
        if "gemini-3.5-flash-lite" not in gem_calls[-1]["url"] or gem_calls[-1]["headers"].get("x-goog-api-key") != "AIza-falsa-123": fail("la prueba debe usar gemini-3.5-flash-lite y x-goog-api-key")
        page.click(".ia-gemini .k-seg >> text=3.8 Flash"); page.click(".ia-gemini >> text=Probar"); page.wait_for_timeout(600)
        if "gemini-3.8-flash" not in gem_calls[-1]["url"]: fail("el selector de modelo debe usar gemini-3.8-flash")
        page.click(".ia-gemini .k-seg >> text=3.5 Flash-Lite")
        sec = json.loads(page.evaluate("localStorage.getItem('mi-plato:secretos')"))
        if sec["claves"].get("gemini") != "AIza-falsa-123": fail("la clave de Gemini debe guardarse en mi-plato:secretos")
        if "AIza" in page.evaluate("localStorage.getItem('mi-plato:v1')"): fail("la clave no debe estar en mi-plato:v1")
        # clave falsa al analizar → cae al modo base
        mock["modo"] = "clave"
        page.click("#tab-hoy"); page.fill("textarea", "un yogur natural y una manzana")
        page.click("text=Corregir mi comida"); page.wait_for_selector(".sheet", timeout=40000)
        cal = page.inner_text(".sheet__head")
        print("   análisis con IA falsa →", cal[:160].replace("\n", " "))
        if "La IA no ha podido ayudar" not in cal: fail("con clave falsa debe avisar y caer al modo base")
        if page.locator(".item-row").count() < 2: fail("tras fallar la IA debe quedar el análisis del modo base")
        page.screenshot(path=f"{OUT}/iphone-390x844-ia-fallo.png")
        page.click(".sheet__foot >> text=Cancelar")
        page.fill("textarea", "")
        # errores en llano: sin cuota y saturado
        for modo, rx in (("429", "Sin cuota"), ("503", "saturado: inténtalo en un momento")):
            mock["modo"] = modo
            page.fill("textarea", "un yogur"); page.click("text=Corregir mi comida"); page.wait_for_selector(".sheet .k-callout.warn", timeout=20000)
            if not re.search(rx, page.inner_text(".sheet__head")): fail(f"error {modo}: mensaje poco claro: {page.inner_text('.sheet__head')[:120]}")
            page.click(".sheet__foot >> text=Cancelar"); page.fill("textarea", "")
        # foto del plato desde el Resumen: Gemini simulado → «Tu comida» editable
        mock["modo"] = "ok"; gem_calls.clear()
        from PIL import Image
        Image.new("RGB", (1600, 1200), (200, 120, 60)).save(f"{OUT}/foto-prueba.jpg", "JPEG")
        page.click("#tab-resumen"); page.wait_for_timeout(150)
        if not page.is_visible(".res__foto"): fail("el Resumen debe tener el botón de foto")
        page.set_input_files("#area-resumen input[type=file]", f"{OUT}/foto-prueba.jpg"); page.wait_for_selector(".sheet .item-row", timeout=20000)
        if page.locator(".item-row").count() != 3: fail(f"la foto debe dar 3 alimentos, hay {page.locator('.item-row').count()}")
        call = gem_calls[-1]
        if "gemini-3.5-flash-lite:generateContent" not in call["url"] or call["headers"].get("x-goog-api-key") != "AIza-falsa-123" or '"inline_data"' not in call["body"] or "application/json" not in call["body"]: fail("la petición de Gemini no lleva modelo/clave/inline_data/JSON")
        filas = [page.locator(".item-row").nth(i).locator(".rac__txt").inner_text() for i in range(3)]
        if not (filas[0].startswith("2 huevos") and filas[1].startswith("2 ") and filas[2].startswith("1 plato")): fail(f"raciones caseras de la foto: {filas}")
        if "Desayuno potente" not in page.inner_text(".sheet__head") or "Añade una ensalada" not in page.inner_text(".sheet"): fail("faltan el resumen o las correcciones de la IA")
        k0 = page.inner_text(".k-metrics.tight")
        page.locator(".item-row").nth(2).locator(".rac__chip", has_text="2").click(); page.wait_for_timeout(100)
        if not page.locator(".item-row").nth(2).locator(".rac__txt").inner_text().startswith("2 platos") or page.inner_text(".k-metrics.tight") == k0: fail("el alimento de la foto debe poder pasar a 2 raciones")
        page.locator(".item-row").nth(0).locator("button[aria-label^='Quitar']").click(); page.wait_for_timeout(100)
        if page.locator(".item-row").count() != 2: fail("debe poder quitarse un alimento de la foto")
        if not page.is_visible(".sheet >> text=+ Añadir alimento"): fail("debe poder añadirse un alimento")
        page.screenshot(path=f"{OUT}/iphone-390x844-foto-gemini.png")
        page.click(".sheet__foot >> text=Cancelar")
        # foto sin clave: manda a Ajustes con aviso
        page.evaluate("localStorage.removeItem('mi-plato:secretos')"); page.reload(); page.wait_for_selector(".res")
        page.set_input_files("#area-resumen input[type=file]", f"{OUT}/foto-prueba.jpg"); page.wait_for_timeout(500)
        if not page.is_visible("#area-ajustes") or "conecta Gemini" not in page.inner_text(".k-toast"): fail("la foto sin clave debe llevar a Ajustes con un aviso")
        # migración: el modelo 2.5 guardado pasa al valor por defecto
        page.evaluate("""() => { const r = JSON.parse(localStorage.getItem('mi-plato:v1')); r.data.ajustes.modelos = { gemini: 'gemini-2.5-flash' }; localStorage.setItem('mi-plato:v1', JSON.stringify(r)); }""")
        page.reload(); page.wait_for_selector(".res"); page.wait_for_timeout(300)
        if json.loads(page.evaluate("localStorage.getItem('mi-plato:v1')"))["data"]["ajustes"]["modelos"].get("gemini"): fail("el modelo gemini-2.5 guardado debe migrarse al nuevo por defecto")
        # escáner: EAN inválido y manual (Open Food Facts simulado)
        def off(route):
            route.fulfill(status=200, headers=CORS, content_type="application/json", body=json.dumps({"status": 1, "product": {"product_name": "Yogur de prueba", "brands": "Hacendado", "serving_quantity": 125, "nutriments": {"energy-kcal_100g": 60, "proteins_100g": 4, "carbohydrates_100g": 5, "sugars_100g": 4, "fiber_100g": 0, "fat_100g": 3}}}))
        ctx.route(re.compile(r"world\.openfoodfacts\.org"), off)
        page.click("#tab-alimentos"); page.click("text=Escanear un producto >> nth=0"); page.wait_for_selector(".sheet")
        page.fill(".sheet input[inputmode=decimal]", "123"); page.click(".sheet >> text=Buscar >> nth=0"); page.wait_for_timeout(200)
        if "8, 12, 13 o 14" not in page.inner_text(".sheet"): fail("el EAN inválido debe avisar")
        if not re.search(r"cámara|permiso", page.inner_text(".sheet")): print("   (aviso: sin cámara en este Chrome y sin mensaje; revisar)")
        page.fill(".sheet input[inputmode=decimal]", "8480000123456"); page.click(".sheet >> text=Buscar >> nth=0"); page.wait_for_selector(".sheet .item-row", timeout=10000)
        if "Yogur de prueba" not in page.inner_text(".sheet") or not page.locator(".sheet .rac").count(): fail("el EAN a mano debe llevar a «Tu comida» con el selector de raciones")
        page.locator(".item-row").first.locator(".rac__chip", has_text="2").click(); page.wait_for_timeout(100)
        if "2 " not in page.locator(".item-row").first.locator(".rac__txt").inner_text(): fail("el producto escaneado debe poder pasar a 2 raciones")
        page.click(".sheet__foot >> text=Cancelar")
        # alimentos: buscar
        page.fill("input[type=search]", "atun"); page.wait_for_timeout(200)
        if "Atún" not in page.inner_text(".resultados"): fail("el buscador no encuentra atún")
        errs = [e for e in errs if "Failed to load resource" not in e]
        if errs: fail(f"errores de consola en el flujo funcional: {errs[:3]}")
        ctx.close()
        # ---------- 3) Raciones: «2 cafés con leche» al añadir, al editar y con texto ----------
        ctx = br.new_context(viewport={"width": 390, "height": 844}, locale="es-ES")
        ctx.add_init_script("localStorage.setItem('mi-plato:v1', %s)" % json.dumps(json.dumps({"schema": 1, "data": {"ajustes": {"usarIA": False, "proveedor": "anthropic", "modelos": {}, "atajo": "Enviar a Coco", "usarAtajo": False, "bienvenida": True}}})))
        page = ctx.new_page(); errs = []
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.goto(URL); page.wait_for_selector(".res"); page.click("#tab-hoy")
        N = lambda t: t.replace("\xa0", " ")
        def kcal_comida(): return N(page.inner_text(".meal-compact__sub"))
        page.fill("textarea", "café con leche"); page.click("text=Corregir mi comida"); page.wait_for_selector(".sheet")
        fila = page.locator(".item-row").first
        # sin abrir nada: selector grande con − [1 café con leche] + y chips ½ 1 2 3
        if not (fila.locator(".rac__b").count() == 2 and fila.locator(".rac__chip").count() == 4 and fila.locator(".rac__txt").inner_text() == "1 café con leche"): fail("el selector de raciones debe verse sin abrir nada")
        k1 = N(page.inner_text(".k-metrics.tight .k-metric >> nth=0"))
        fila.locator(".rac__chip", has_text="2").click(); page.wait_for_timeout(100)
        if fila.locator(".rac__txt").inner_text() != "2 cafés con leche": fail("el chip 2 debe poner «2 cafés con leche»: " + fila.locator(".rac__txt").inner_text())
        k2 = N(page.inner_text(".k-metrics.tight .k-metric >> nth=0"))
        if int(k2.split()[0]) != 2 * int(k1.split()[0]): fail(f"las calorías deben duplicarse: {k1} → {k2}")
        page.click(".sheet__foot .k-btn--primary"); page.wait_for_timeout(300)
        if kcal_comida() != "%s kcal" % k2.split()[0] and k2.split()[0] not in kcal_comida(): fail(f"en Hoy deben verse las calorías dobles ({k2}): {kcal_comida()}")
        if "2 cafés con leche" not in N(meals_txt(page)): fail("en la fila de Hoy debe poner «2 cafés con leche»: " + meals_txt(page))
        # editar y volver a 1
        page.click(".meal-compact__details >> text=Editar"); page.wait_for_selector(".sheet")
        fila = page.locator(".item-row").first
        if fila.locator(".rac__txt").inner_text() != "2 cafés con leche" or fila.locator(".rac__chip[aria-pressed=true]").inner_text() != "2": fail("al editar debe verse «2 cafés con leche» con el chip 2 activo")
        fila.locator(".rac__chip", has_text="1").click(); page.wait_for_timeout(100)
        page.click(".sheet__foot .k-btn--primary"); page.wait_for_timeout(300)
        if k1.split()[0] not in kcal_comida() or "1 café con leche" not in N(meals_txt(page)): fail("tras editar a 1 debe verse «1 café con leche» y las calorías de una ración: " + kcal_comida())
        # con «+»
        page.click(".meal-compact__details >> text=Editar"); page.wait_for_selector(".sheet")
        page.locator(".item-row").first.locator(".rac__b", has_text="+").click(); page.wait_for_timeout(100)
        if page.locator(".item-row").first.locator(".rac__txt").inner_text() != "2 cafés con leche": fail("«+» una vez debe dar 2 cafés con leche")
        page.click(".sheet__foot >> text=Cancelar")
        # con texto
        for frase in ("dos cafés con leche", "2 cafés con leche"):
            page.fill("textarea", frase); page.click("text=Corregir mi comida"); page.wait_for_selector(".sheet")
            if page.locator(".item-row").first.locator(".rac__txt").inner_text() != "2 cafés con leche": fail(f"«{frase}» debe dar 2 raciones")
            page.click(".sheet__foot >> text=Cancelar"); page.fill("textarea", "")
        # chip de «Lo de siempre» → abre «Tu comida» con selector
        page.locator(".chip-btn").first.click(); page.wait_for_selector(".sheet .rac")
        page.click(".sheet__foot >> text=Cancelar")
        errs = [e for e in errs if "Failed to load resource" not in e]
        if errs: fail(f"errores de consola en raciones: {errs[:3]}")
        ctx.close()
        # ---------- 4) Escáner con cámara (cámara falsa de Chrome): carga ZXing, decodifica un EAN dibujado y se para al cerrar ----------
        br2 = p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True, args=["--no-sandbox", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"])
        ctx = br2.new_context(viewport={"width": 390, "height": 844}, locale="es-ES", permissions=["camera"])
        ctx.add_init_script("localStorage.setItem('mi-plato:v1', %s)" % json.dumps(json.dumps({"schema": 1, "data": {"ajustes": {"usarIA": False, "proveedor": "anthropic", "modelos": {}, "atajo": "Enviar a Coco", "usarAtajo": False, "bienvenida": True}}})))
        page = ctx.new_page(); errs = []
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.goto(URL); page.wait_for_selector(".res"); page.click("#tab-hoy")
        page.click("button[aria-label='Escanear código de barras']"); page.wait_for_selector(".cam video", timeout=10000); page.wait_for_timeout(1500)
        v = page.evaluate("(() => { const v = document.querySelector('.cam video'); return { ok: v.videoWidth > 0, play: v.getAttribute('playsinline') !== null, muted: v.muted, live: !!v.srcObject && v.srcObject.getTracks().some(t => t.readyState === 'live') } })()")
        if not (v["ok"] and v["play"] and v["muted"] and v["live"]): fail(f"la cámara no arranca bien (playsinline/muted/live): {v}")
        if not page.is_visible(".cam__frame"): fail("falta el marco guía del escáner")
        if not page.evaluate("!!window.BarcodeDetector || !!window.MiPlatoZXing"): fail("sin BarcodeDetector debe cargarse ZXing")
        page.screenshot(path=f"{OUT}/iphone-390x844-escaner.png")
        # decodifica un EAN-13 dibujado en un lienzo (comprueba que ZXing funciona de verdad)
        cod = page.evaluate("""async () => {
          if (!window.MiPlatoZXing) await new Promise((ok) => { const s = document.createElement('script'); s.src = './zxing.js'; s.onload = ok; document.head.appendChild(s); });
          const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
          const G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
          const R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
          const P = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
          const d = '8480000123459'.split('').map(Number); const p = P[d[0]];
          let bits = '101'; for (let i = 1; i <= 6; i++) bits += (p[i-1] === 'L' ? L : G)[d[i]]; bits += '01010'; for (let i = 7; i <= 12; i++) bits += R[d[i]]; bits += '101';
          const m = 4, c = document.createElement('canvas'); c.width = (bits.length + 20) * m; c.height = 200;
          const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#000';
          [...bits].forEach((b, i) => { if (b === '1') x.fillRect((i + 10) * m, 20, m, 160); });
          return window.MiPlatoZXing.decodificar(c);
        }""")
        if cod != "8480000123459": fail(f"ZXing no decodifica el EAN dibujado: {cod}")
        page.click(".cam >> text=Cerrar cámara"); page.wait_for_timeout(200)
        if page.query_selector(".cam video"): fail("al cerrar la cámara debe quitarse la vista previa")
        page.click(".sheet__foot >> text=Cerrar"); page.wait_for_timeout(200)
        errs = [e for e in errs if "Failed to load resource" not in e]
        if errs: fail(f"errores de consola en el escáner: {errs[:3]}")
        ctx.close(); br2.close()
        # sin permiso de cámara: mensaje claro con alternativas
        ctx = br.new_context(viewport={"width": 390, "height": 844}, locale="es-ES")
        ctx.add_init_script("""navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))""")
        page = ctx.new_page(); page.goto(URL); page.wait_for_selector(".res"); page.click("#tab-hoy")
        page.click("button[aria-label='Escanear código de barras']"); page.wait_for_selector(".sheet [role=alert]")
        t = page.inner_text(".sheet [role=alert]")
        if "permiso" not in t or "foto del código" not in t: fail("el permiso denegado debe explicar las alternativas: " + t)
        if not page.is_visible(".sheet >> text=Hacer foto del código") or not page.is_visible(".sheet input[inputmode=decimal]"): fail("con la cámara denegada deben quedar la foto y el EAN a mano")
        ctx.close()
        br.close()

run()
print("\nOK: todo correcto" if not fails else f"\n{len(fails)} problema(s)")
sys.exit(1 if fails else 0)
