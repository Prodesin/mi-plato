#!/workspace/pwenv/bin/python
"""Comprobación en navegador (Chrome headless + playwright): sin desbordes, sin errores de consola y flujo funcional.
Uso: python3 -m http.server 8782 (en la carpeta del proyecto; 8781 estaba ocupado por otro servidor) y /workspace/pwenv/bin/python tools/check-ui.py"""
import json, os, sys, datetime, re
from playwright.sync_api import sync_playwright

URL = os.environ.get("MI_PLATO_URL", "http://localhost:8782/index.html")
OUT = "/workspace/mi-plato-capturas"
os.makedirs(OUT, exist_ok=True)
VIEWS = [("exterior", 466, 678), ("exterior", 678, 466), ("interior", 951, 669), ("interior", 669, 951), ("iphone", 390, 844)]
TABS = ["hoy", "semana", "alimentos", "ajustes"]
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
        page.goto(URL); page.wait_for_selector(".welcome")
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
        if "Café con leche" not in meals_txt(page): fail("la comida guardada no aparece en Hoy")
        if page.input_value("textarea") != "": fail("el texto debería vaciarse al guardar")
        page.fill("textarea", "un plato de lentejas")
        page.click("text=Corregir mi comida"); page.wait_for_selector(".sheet")
        if not page.locator(".rac__txt").first.inner_text().startswith("1 plato"): fail("«un plato de lentejas» debería verse como «1 plato…»")
        page.locator(".item-row__name").first.click(); page.wait_for_timeout(100)
        if page.locator(".qty__in input").first.input_value() != "300": fail("«un plato de lentejas» debería ser 300 g en el detalle")
        page.click(".sheet__foot .k-btn--primary"); page.wait_for_timeout(300)
        page.screenshot(path=f"{OUT}/iphone-390x844-hoy-funcional.png", full_page=True)
        page.reload(); page.wait_for_selector(".meals")
        t = meals_txt(page)
        if "Lentejas" not in t or "Café con leche" not in t: fail("los datos no persisten tras recargar")
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
        if "Lentejas" not in meals_txt(page): fail("la importación no restaura las comidas")
        # importación inválida
        open(f"{OUT}/malo.json", "w").write('{"app":"otra","data":{}}')
        page.click("#tab-ajustes"); page.set_input_files("input[type=file][accept*=json]", f"{OUT}/malo.json"); page.wait_for_timeout(300)
        if "no es una copia de Mi plato" not in page.inner_text(".k-toast"): fail("la importación inválida debe avisar")
        # ---------- IA con clave falsa ----------
        page.click("text=Usar IA además del modo base")
        page.fill("input[placeholder='pega aquí tu clave']", "sk-clave-falsa-123")
        page.click("text=Probar conexión"); page.wait_for_timeout(2500)
        msg = page.inner_text(".k-toast")
        print("   prueba de conexión IA →", msg)
        if not re.search(r"clave|conectar|límite|modelo|Ha tardado", msg): fail("la prueba de conexión con clave falsa debe dar un mensaje amable")
        page.click("#tab-hoy"); page.fill("textarea", "un yogur natural y una manzana")
        page.click("text=Corregir mi comida"); page.wait_for_selector(".sheet", timeout=40000)
        cal = page.inner_text(".sheet__head")
        print("   análisis con IA falsa →", cal[:160].replace("\n", " "))
        if "La IA no ha podido ayudar" not in cal: fail("con clave falsa debe avisar y caer al modo base")
        if page.locator(".item-row").count() < 2: fail("tras fallar la IA debe quedar el análisis del modo base")
        page.screenshot(path=f"{OUT}/iphone-390x844-ia-fallo.png")
        page.click(".sheet__foot >> text=Cancelar")
        # escáner: EAN inválido y manual
        page.click("#tab-alimentos"); page.click("text=Escanear un producto >> nth=0"); page.wait_for_selector(".sheet")
        page.fill(".sheet input[inputmode=decimal]", "123"); page.click(".sheet >> text=Buscar >> nth=0"); page.wait_for_timeout(200)
        if "8, 12, 13 o 14" not in page.inner_text(".sheet"): fail("el EAN inválido debe avisar")
        page.click(".sheet__foot >> text=Cerrar")
        # alimentos: buscar
        page.fill("input[type=search]", "atun"); page.wait_for_timeout(200)
        if "Atún" not in page.inner_text(".resultados"): fail("el buscador no encuentra atún")
        errs = [e for e in errs if "Failed to load resource" not in e]
        if errs: fail(f"errores de consola en el flujo funcional: {errs[:3]}")
        ctx.close()
        br.close()

run()
print("\nOK: todo correcto" if not fails else f"\n{len(fails)} problema(s)")
sys.exit(1 if fails else 0)
