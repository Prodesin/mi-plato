/* Base de alimentos española (por 100 g o 100 ml, tal como se come: cocinado si procede).
 * Valores aproximados según BEDCA / tablas de Moreiras y etiquetas habituales de Mercadona y Eroski.
 * «Hidratos» = hidratos totales (incluyen azúcares y fibra). Raciones: «1 lata:52» = nombre de la unidad y gramos. */
import type { Food, IG, Racion } from "./types";
import { norm } from "./util";

export function slug(s: string): string {
  return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function parseRacion(s: string): Racion {
  const [n, gs] = s.split(":");
  const m = n.trim().match(/^(\d+(?:[.,]\d+)?)\s+(.*)$/);
  const cant = m ? parseFloat(m[1].replace(",", ".")) : 1;
  const sing = (m ? m[2] : n).trim();
  return { n: n.trim(), g: parseFloat(gs) / (cant || 1), cant: 1, sing };
}

function F(n: string, cat: string, kcal: number, p: number, c: number, az: number, fi: number, gr: number, ig: IG, syn: string, rac: string, alc?: number): Food {
  return {
    id: slug(n), n, cat, kcal, p, c, az, fi, gr, ig, alc,
    syn: syn ? syn.split("|") : [],
    rac: rac ? rac.split("|").map(parseRacion) : [],
    fuente: "base",
  };
}

export const FOODS: Food[] = [
  // ---- Huevos y lácteos ----
  F("Huevo", "huevo", 143, 12.6, 0.7, 0.4, 0, 9.8, "bajo", "huevos|huevo cocido|huevo duro|huevo a la plancha|huevos cocidos", "1 huevo:60"),
  F("Huevo frito", "huevo", 196, 13.6, 0.8, 0.4, 0, 15.3, "bajo", "huevos fritos", "1 huevo frito:55"),
  F("Huevos revueltos", "huevo", 170, 11, 1, 0.8, 0, 13, "bajo", "revuelto|revuelto de huevos|huevos revueltos", "1 ración:120"),
  F("Clara de huevo", "huevo", 52, 11, 0.7, 0.7, 0, 0.2, "bajo", "claras|claras de huevo|clara", "1 clara:33|1 ración:150"),
  F("Tortilla francesa", "huevo", 175, 12, 0.7, 0.5, 0, 13.5, "bajo", "tortilla de huevo|tortilla de 2 huevos", "1 tortilla:120"),
  F("Huevos rotos", "plato", 220, 9, 16, 1, 1.5, 13.5, "alto", "huevos rotos con jamon|huevos rotos con patatas", "1 ración:250"),
  F("Leche semidesnatada", "lacteo", 46, 3.4, 4.8, 4.8, 0, 1.6, "bajo", "leche|leche semi|vaso de leche", "1 vaso:200|1 taza:200"),
  F("Leche entera", "lacteo", 63, 3.2, 4.7, 4.7, 0, 3.6, "bajo", "leche entera", "1 vaso:200|1 taza:200"),
  F("Leche desnatada", "lacteo", 34, 3.4, 4.9, 4.9, 0, 0.2, "bajo", "leche desnatada", "1 vaso:200|1 taza:200"),
  F("Bebida de soja sin azúcar", "lacteo", 33, 3.3, 0.5, 0.4, 0.5, 1.8, "bajo", "leche de soja|bebida de soja|soja", "1 vaso:200"),
  F("Bebida de avena", "lacteo", 45, 0.5, 8, 4, 0.8, 1.2, "medio", "leche de avena|bebida de avena", "1 vaso:200"),
  F("Bebida de almendras sin azúcar", "lacteo", 14, 0.5, 0.3, 0.1, 0, 1.1, "bajo", "leche de almendras|bebida de almendras", "1 vaso:200"),
  F("Yogur natural", "lacteo", 61, 3.5, 4.7, 4.7, 0, 3.3, "bajo", "yogur|yogures|yogurt|yogur sin azucar", "1 yogur:125"),
  F("Yogur natural desnatado", "lacteo", 40, 4, 5, 5, 0, 0.1, "bajo", "yogur desnatado|yogur 0|yogur 0%", "1 yogur:125"),
  F("Yogur griego natural", "lacteo", 115, 5.5, 4, 4, 0, 8.5, "bajo", "yogur griego|griego", "1 yogur:125"),
  F("Yogur de proteínas", "lacteo", 56, 10, 4, 3.8, 0, 0.2, "bajo", "yogur proteinas|yogur proteico|yogur alto en proteinas|yogur de proteina|yogur proteina", "1 yogur:160"),
  F("Skyr", "lacteo", 63, 11, 4, 3.5, 0, 0.2, "bajo", "skyr natural", "1 envase:150"),
  F("Yogur de sabores", "lacteo", 90, 3.3, 14, 13.5, 0, 2.3, "medio", "yogur de fresa|yogur de limon|yogur de sabores|yogur azucarado|yogur de frutas|yogur con azucar|yogur de coco|yogur de vainilla", "1 yogur:125"),
  F("Kéfir", "lacteo", 55, 3.5, 4.5, 4.5, 0, 2.2, "bajo", "kefir", "1 vaso:200"),
  F("Queso fresco batido 0%", "lacteo", 46, 7.5, 4, 4, 0, 0.2, "bajo", "queso batido|queso fresco batido|queso batido 0|queso fresco 0|batido 0 de queso", "1 tarrina:125|1 cucharada:30"),
  F("Queso fresco", "lacteo", 174, 13, 3.5, 3, 0, 12, "bajo", "queso de burgos|queso burgos|queso fresco de burgos|queso blanco", "1 ración:60|1 cuña:100"),
  F("Queso fresco light", "lacteo", 100, 12.5, 3.5, 3, 0, 4, "bajo", "queso burgos light|queso fresco 0 grasa|burgos 0%", "1 ración:60|1 cuña:100"),
  F("Requesón", "lacteo", 98, 11, 3.4, 3.4, 0, 4.3, "bajo", "cottage|queso cottage|requeson", "1 ración:100"),
  F("Queso curado", "lacteo", 400, 27, 0.5, 0.5, 0, 32, "bajo", "queso manchego|manchego|queso curado|queso viejo", "1 cuña:30|1 loncha:25"),
  F("Queso semicurado", "lacteo", 370, 25, 1, 0.5, 0, 30, "bajo", "queso semi|queso semicurado|queso", "1 cuña:30|1 loncha:25"),
  F("Queso en lonchas", "lacteo", 300, 22, 1, 0.5, 0, 23, "bajo", "queso de sandwich|lonchas de queso|queso lonchas|loncha de queso", "1 loncha:20"),
  F("Queso tetilla", "lacteo", 326, 22, 1, 0.5, 0, 26, "bajo", "tetilla|queso gallego", "1 cuña:30|1 loncha:25"),
  F("Mozzarella", "lacteo", 250, 18, 1, 0.5, 0, 19, "bajo", "mozarela|mozzarela", "1 bola:125|1 ración:50"),
  F("Queso rallado", "lacteo", 334, 24, 1, 0.5, 0, 26, "bajo", "queso rallado", "1 cucharada:10|1 puñado:30"),
  F("Parmesano", "lacteo", 396, 36, 0, 0, 0, 28, "bajo", "queso parmesano|grana padano", "1 cucharada:10|1 cuña:30"),
  F("Queso crema", "lacteo", 247, 6, 4, 3, 0, 23, "bajo", "queso de untar|philadelphia|queso para untar|queso crema", "1 cucharada:15|1 porción:20"),
  F("Nata para cocinar", "lacteo", 195, 2.5, 3.5, 3, 0, 19, "bajo", "nata|crema de leche", "1 cucharada:15"),
  F("Natillas", "dulce", 119, 3.3, 18, 16, 0, 3.8, "medio", "natillas", "1 natillas:125"),
  F("Flan", "dulce", 131, 4, 22, 20, 0, 3, "medio", "flan de huevo|flan", "1 flan:110"),
  F("Arroz con leche", "dulce", 130, 3, 22, 12, 0.2, 3.3, "alto", "arroz con leche", "1 cuenco:150"),
  F("Helado", "dulce", 200, 3.5, 24, 21, 0, 10, "medio", "helado|helados|cucurucho|polo", "1 bola:60|1 tarrina:100"),
  // ---- Carnes y embutidos ----
  F("Pechuga de pollo a la plancha", "carne", 160, 31, 0, 0, 0, 3.6, "bajo", "pollo|pechuga|pechuga de pollo|pollo a la plancha|filete de pollo|tiras de pollo|pollo cocido|pollo hervido", "1 filete:150|1 pechuga:200"),
  F("Muslo de pollo asado", "carne", 190, 26, 0, 0, 0, 9, "bajo", "muslo de pollo|muslo|muslos de pollo|contramuslo", "1 muslo:90"),
  F("Pollo asado", "carne", 215, 25, 0, 0, 0, 12.5, "bajo", "pollo asado|cuarto de pollo|pollo al horno|pollo de asador|pollo con piel", "1 cuarto:150"),
  F("Pavo a la plancha", "carne", 145, 30, 0, 0, 0, 2.5, "bajo", "pavo|pechuga de pavo|filete de pavo|pavo a la plancha", "1 filete:150"),
  F("Pechuga de pavo en lonchas", "embutido", 100, 17, 2, 1, 0, 2.5, "bajo", "fiambre de pavo|pavo cocido|pavo en lonchas|lonchas de pavo|pechuga de pavo cocida|jamon de pavo|fiambre", "1 loncha:15|1 ración:60"),
  F("Jamón cocido", "embutido", 105, 17.5, 1, 0.5, 0, 3.5, "bajo", "jamon york|york|jamon de york|jamon cocido|fiambre de jamon|jamon dulce", "1 loncha:20"),
  F("Jamón serrano", "embutido", 237, 30, 0.1, 0, 0, 13, "bajo", "jamon|jamon serrano|jamon curado|loncha de jamon", "1 loncha:15|1 ración:50"),
  F("Jamón ibérico", "embutido", 294, 33, 0, 0, 0, 18, "bajo", "jamon iberico|pata negra|jamon de bellota", "1 loncha:15|1 ración:50"),
  F("Lomo embuchado", "embutido", 256, 45, 1, 0, 0, 8, "bajo", "lomo curado|lomo", "1 loncha:15|1 ración:50"),
  F("Chorizo", "embutido", 446, 24, 2, 1, 0, 38, "bajo", "chorizo|chorizo curado|chorizo ibérico", "1 rodaja:7|1 ración:40"),
  F("Salchichón", "embutido", 428, 25, 1, 0.5, 0, 36, "bajo", "salchichon|fuet|longaniza|sobrasada", "1 rodaja:7|1 ración:40"),
  F("Salchichas", "embutido", 267, 12, 3, 1, 0, 23, "bajo", "salchicha|frankfurt|salchichas de pollo|salchichas frankfurt", "1 salchicha:50"),
  F("Beicon", "embutido", 346, 14, 0.5, 0, 0, 32, "bajo", "bacon|panceta|tocino|beicon frito", "1 loncha:15"),
  F("Lacón cocido", "embutido", 196, 22, 0, 0, 0, 12, "bajo", "lacon|lacon con grelos", "1 ración:100"),
  F("Ternera a la plancha", "carne", 188, 28, 0, 0, 0, 8.5, "bajo", "ternera|filete de ternera|bistec|carne|filete|carne de ternera|entrecot|chuleton|vacuno|carne a la plancha", "1 filete:150"),
  F("Carne picada de ternera", "carne", 211, 19, 0, 0, 0, 15, "bajo", "carne picada|picada|picada de ternera|carne picada de ternera", "1 ración:120"),
  F("Hamburguesa de ternera", "carne", 250, 20, 2, 0.5, 0.3, 18, "bajo", "hamburguesa|burger|hamburguesa casera|hamburguesa de carne", "1 hamburguesa:120"),
  F("Burger meat de pollo", "carne", 152, 19, 2, 0.5, 0.3, 7.5, "bajo", "burger de pollo|hamburguesa de pollo|burger meat|burguer de pollo|hamburguesa de pavo", "1 hamburguesa:100"),
  F("Lomo de cerdo a la plancha", "carne", 197, 28, 0, 0, 0, 9.5, "bajo", "lomo de cerdo|cerdo|filete de cerdo|lomo a la plancha|carne de cerdo|filete de lomo", "1 filete:130"),
  F("Solomillo de cerdo", "carne", 149, 26, 0, 0, 0, 5, "bajo", "solomillo|solomillo de cerdo|solomillo a la plancha", "1 ración:150"),
  F("Costillas de cerdo", "carne", 286, 22, 0, 0, 0, 22, "bajo", "costillas|costilla|costillas asadas|costillas de cerdo", "1 ración:200"),
  F("Cordero asado", "carne", 253, 25, 0, 0, 0, 17, "bajo", "cordero|chuletas de cordero|chuleta de cordero|cordero asado", "1 chuleta:80|1 ración:150"),
  F("Conejo", "carne", 150, 24, 0, 0, 0, 6, "bajo", "conejo guisado|conejo asado", "1 ración:150"),
  F("Albóndigas con tomate", "plato", 187, 13, 8, 2, 0.8, 11.5, "bajo", "albondigas|albondigas en salsa|albondigas con salsa", "1 albóndiga:30|1 ración:150"),
  F("Filete empanado", "plato", 254, 12, 20, 1, 1, 14, "medio", "san jacobo|escalope|milanesa|filete empanado|cachopo|pollo empanado", "1 unidad:100"),
  F("Nuggets de pollo", "plato", 254, 15, 17, 0.5, 1, 14, "medio", "nuggets|nugget|fingers de pollo", "1 nugget:20|1 ración:100"),
  // ---- Pescados y mariscos ----
  F("Atún al natural", "pescado", 109, 24, 0, 0, 0, 1, "bajo", "atun|lata de atun|atun en lata|atun natural|atun claro|atun al natural", "1 lata:52|1 lata grande:80"),
  F("Atún en aceite", "pescado", 199, 25, 0, 0, 0, 11, "bajo", "atun en aceite|atun con aceite|lata de atun en aceite|bonito en aceite|bonito", "1 lata:52"),
  F("Atún fresco a la plancha", "pescado", 145, 25, 0, 0, 0, 5, "bajo", "atun fresco|bonito fresco|atun a la plancha", "1 filete:150"),
  F("Caballa en conserva", "pescado", 232, 22, 0, 0, 0, 16, "bajo", "caballa|caballa en lata|caballa en aceite", "1 lata:80"),
  F("Sardinas en lata", "pescado", 208, 24, 0, 0, 0, 12.5, "bajo", "sardinas en aceite|sardinillas|sardinas en conserva|lata de sardinas|sardinillas en aceite", "1 lata:65"),
  F("Sardinas a la plancha", "pescado", 187, 22, 0, 0, 0, 11, "bajo", "sardinas|sardina|sardinas asadas", "1 ración:120"),
  F("Anchoas en conserva", "pescado", 177, 24, 0, 0, 0, 9, "bajo", "anchoas|anchoa|boquerones en aceite", "1 ración:30|1 anchoa:4"),
  F("Boquerones en vinagre", "pescado", 129, 16, 0.5, 0, 0, 7, "bajo", "boquerones|boqueron", "1 ración:80"),
  F("Salmón a la plancha", "pescado", 205, 22, 0, 0, 0, 13, "bajo", "salmon|salmon al horno|lomo de salmon|salmon a la plancha", "1 lomo:150"),
  F("Salmón ahumado", "pescado", 169, 22, 0, 0, 0, 9, "bajo", "salmon ahumado|ahumado", "1 loncha:20|1 ración:60"),
  F("Merluza a la plancha", "pescado", 98, 20, 0, 0, 0, 2, "bajo", "merluza|merluza al horno|merluza hervida|pescadilla|pescado blanco|pescado|filete de merluza|gallo|abadejo", "1 filete:150|1 ración:180"),
  F("Bacalao", "pescado", 101, 23, 0, 0, 0, 1, "bajo", "bacalao desalado|bacalao cocido|bacalao a la plancha", "1 ración:180"),
  F("Dorada o lubina", "pescado", 120, 20, 0, 0, 0, 4.5, "bajo", "dorada|lubina|besugo|lubina al horno|dorada al horno|pescado al horno", "1 ración:150"),
  F("Rape", "pescado", 85, 18, 0, 0, 0, 1.5, "bajo", "rape a la plancha|rape", "1 ración:150"),
  F("Trucha", "pescado", 130, 20, 0, 0, 0, 5.5, "bajo", "trucha al horno|trucha a la plancha|trucha", "1 trucha:200|1 ración:150"),
  F("Gambas cocidas", "pescado", 99, 21, 0.5, 0, 0, 1.5, "bajo", "gambas|langostinos|gambas a la plancha|gamba|langostino|gambones", "1 ración:100|1 gamba:12"),
  F("Mejillones", "pescado", 82, 12, 3.5, 0, 0, 2.2, "bajo", "mejillones al natural|mejillones cocidos|mejillones en lata|mejillon|almejas|berberechos", "1 lata:70|1 ración:150"),
  F("Calamares a la romana", "pescado", 219, 12, 18, 0.5, 0.8, 11, "medio", "calamares|calamares fritos|rabas|calamar", "1 ración:150"),
  F("Sepia o chipirones a la plancha", "pescado", 81, 16, 1, 0, 0, 1.5, "bajo", "sepia|chipirones|chopitos|jibia|calamar a la plancha", "1 ración:150"),
  F("Pulpo á feira", "plato", 120, 14, 6, 0.5, 0.8, 4.5, "medio", "pulpo|pulpo a feira|pulpo a la gallega|pulpo con patatas|pulpo cocido", "1 ración:200|1 plato:200"),
  F("Palitos de merluza empanados", "plato", 207, 10, 17, 1, 1, 11, "medio", "palitos de merluza|varitas de merluza|pescado rebozado|pescado empanado|merluza rebozada|merluza empanada", "1 palito:25|1 ración:125"),
  F("Surimi", "pescado", 85, 8, 12, 5, 0.3, 0.5, "medio", "palitos de cangrejo|barritas de surimi|palitos de surimi|surimi", "1 palito:15|1 ración:80"),
  // ---- Legumbres ----
  F("Lentejas cocidas", "legumbre", 116, 9, 20, 1, 7.9, 0.4, "bajo", "lentejas|lenteja|lentejas de bote|bote de lentejas|lentejas hervidas|lentejas pardinas", "1 plato:300|1 ración:200|1 bote:240"),
  F("Lentejas estofadas", "plato", 132, 8, 15, 1.5, 5, 4.5, "bajo", "lentejas estofadas|lentejas con chorizo|lentejas guisadas|lentejas de la abuela|lentejas con verduras|lentejas con arroz", "1 plato:300"),
  F("Garbanzos cocidos", "legumbre", 150, 8.5, 22, 3, 6.5, 2.6, "bajo", "garbanzos|garbanzos de bote|bote de garbanzos|garbanzo|garbanzos hervidos", "1 ración:150|1 plato:250|1 bote:240"),
  F("Garbanzos con espinacas", "plato", 118, 6.5, 13, 1, 5, 4.5, "bajo", "potaje|garbanzos con espinacas|potaje de garbanzos|potaje de vigilia|garbanzos guisados", "1 plato:300"),
  F("Alubias blancas cocidas", "legumbre", 100, 7, 14.5, 0.5, 6.3, 0.5, "bajo", "alubias|alubias blancas|judias blancas|alubias de bote|fabes|alubia", "1 plato:300|1 ración:200"),
  F("Alubias pintas", "legumbre", 105, 7, 15, 1, 6, 0.6, "bajo", "judias pintas|alubias rojas|alubias pintas|frijoles|judias rojas", "1 plato:300|1 ración:200"),
  F("Fabada asturiana", "plato", 144, 8, 10, 1, 4, 8, "bajo", "fabada|fabada con chorizo", "1 plato:350"),
  F("Cocido", "plato", 159, 10, 14, 1, 4, 7, "bajo", "cocido|cocido madrileño|cocido gallego|cocido completo|puchero", "1 plato:400"),
  F("Guisantes", "legumbre", 70, 5.5, 9, 4, 5, 0.4, "bajo", "guisantes|guisantes cocidos|guisantes congelados|guisante|chicharos", "1 ración:120|1 puñado:50"),
  F("Habas", "legumbre", 66, 6, 7.5, 1, 5, 0.5, "bajo", "habas|habas cocidas|habitas|habas tiernas", "1 ración:150"),
  F("Hummus", "legumbre", 221, 7, 10, 0.5, 5.5, 17, "bajo", "humus|hummus|hummus de garbanzos|crema de garbanzos", "1 ración:50|1 cucharada:25"),
  F("Tofu", "legumbre", 123, 13, 2, 0.5, 1, 7, "bajo", "tofu|tofu a la plancha|queso de soja", "1 ración:120"),
  // ---- Pan, cereales, pasta, arroz, patata ----
  F("Pan blanco", "pan", 258, 8.5, 53, 3, 2.5, 1.3, "alto", "pan|barra de pan|pan de barra|pan normal|baguette|pan blanco|panecillo|pan del dia|pistola|pan candeal|mollete|pulga", "1 rebanada:30|1 trozo:40|1 barra:250|1 panecillo:60|1 tostada:35"),
  F("Pan integral", "pan", 235, 9, 43, 3, 7, 3, "medio", "pan integral|tostada integral|pan integral de barra|pan con cereales|pan de semillas|pan de espelta|pan de centeno", "1 rebanada:30|1 tostada:35|1 barra:250|1 panecillo:60"),
  F("Pan de molde blanco", "pan", 263, 8, 50, 4, 3, 3.5, "alto", "pan de molde|pan bimbo|pan de sandwich|pan de molde blanco|pan lactal", "1 rebanada:25"),
  F("Pan de molde integral", "pan", 240, 10, 41, 4, 7, 4, "medio", "pan de molde integral|pan integral de molde|pan bimbo integral", "1 rebanada:25"),
  F("Pan de pita", "pan", 267, 9, 55, 1, 2.2, 1.2, "alto", "pita|pan pita|pan arabe|kebab pan", "1 pan:60"),
  F("Tortilla de trigo", "pan", 305, 8.5, 52, 2, 3, 7, "alto", "wrap|wraps|tortilla de trigo|tortilla mexicana|tortilla para fajitas|fajita|tortillas de trigo", "1 tortilla:60"),
  F("Biscotes", "pan", 386, 11, 72, 3, 5, 6, "alto", "biscote|tostadas|pan tostado|biscotes integrales", "1 biscote:10"),
  F("Tortitas de arroz", "pan", 387, 8, 82, 0.5, 3, 3, "alto", "tortita de arroz|tortitas de arroz|galletas de arroz|torta de arroz", "1 tortita:9"),
  F("Tortitas de maíz", "pan", 383, 8, 80, 0.5, 4, 3.5, "alto", "tortita de maiz|tortitas de maiz|tortitas|tortita", "1 tortita:8"),
  F("Cruasán", "bolleria", 410, 8, 45, 8, 2, 22, "alto", "croissant|cruasan|croasan|cruasan plano", "1 cruasán:60"),
  F("Napolitana de chocolate", "bolleria", 419, 7, 46, 16, 2, 23, "alto", "napolitana|palmera de chocolate|napolitana de chocolate|pan de chocolate", "1 napolitana:75"),
  F("Magdalena", "bolleria", 421, 6, 52, 28, 1.4, 21, "alto", "magdalenas|magdalena|madalena|mantecada|bollo|bollito", "1 magdalena:35"),
  F("Donut", "bolleria", 419, 5, 48, 22, 1.5, 23, "alto", "donuts|donut|rosquilla|berlina|dona", "1 donut:60"),
  F("Churros", "bolleria", 380, 5, 45, 8, 1.5, 20, "alto", "churro|churros con chocolate|porras|porra", "1 churro:40|1 ración:120"),
  F("Galletas María", "bolleria", 423, 7, 74, 22, 3, 11, "alto", "galletas maria|galleta maria|galletas|galleta|galletas tostadas|galletas de desayuno|marias", "1 galleta:6|1 ración:30"),
  F("Galletas integrales", "bolleria", 436, 7, 66, 20, 6, 16, "medio", "galletas integrales|galleta integral|galletas de avena|digestive", "1 galleta:10"),
  F("Galletas con chocolate", "bolleria", 477, 6, 66, 30, 3, 21, "alto", "galletas con pepitas|cookies|cookie|galletas de chocolate|oreo|galletas rellenas", "1 galleta:12"),
  F("Cereales de desayuno", "cereal", 373, 7, 84, 8, 3, 1, "alto", "cereales|copos de maiz|corn flakes|cereales de desayuno|cereales azucarados|chocapic|cereales con chocolate|cereales de chocolate", "1 bol:50|1 ración:30"),
  F("Muesli", "cereal", 351, 10, 62, 12, 8, 7, "medio", "muesli|granola|cereales integrales|cereales de avena", "1 bol:50"),
  F("Copos de avena", "cereal", 355, 13, 60, 1, 10, 7, "bajo", "avena|copos de avena|harina de avena|avena en copos", "1 cucharada:10|1 ración:40|1 bol:40"),
  F("Gachas de avena con leche", "cereal", 90, 4, 13, 3, 1.5, 2.5, "bajo", "gachas|porridge|gachas de avena|papilla de avena", "1 bol:250"),
  F("Arroz blanco cocido", "arroz", 126, 2.7, 28, 0.1, 0.6, 0.3, "alto", "arroz|arroz blanco|arroz hervido|arroz cocido|arroz basmati|arroz largo", "1 ración:150|1 plato:200"),
  F("Arroz integral cocido", "arroz", 120, 2.7, 25, 0.3, 1.8, 1, "medio", "arroz integral|arroz integral cocido", "1 ración:150|1 plato:200"),
  F("Arroz con tomate", "arroz", 149, 3, 27, 2, 1.2, 3.2, "alto", "arroz con tomate|arroz con tomate y huevo|arroz a la cubana|arroz frito", "1 plato:250"),
  F("Arroz con pollo", "plato", 156, 9, 20, 1, 1.3, 4.5, "alto", "arroz con pollo|arroz con carne|arroz con conejo", "1 plato:350|1 ración:300"),
  F("Paella", "plato", 149, 7, 20, 1, 1.3, 4.5, "alto", "paella|paella mixta|paella valenciana|arroz con marisco|arroz caldoso|arroz negro|paella de marisco", "1 plato:350|1 ración:300"),
  F("Arroz tres delicias", "arroz", 160, 5, 26, 1.5, 1.5, 4, "alto", "arroz tres delicias|arroz chino|arroz frito chino", "1 plato:300"),
  F("Pasta cocida", "pasta", 155, 5.8, 31, 1, 2, 0.9, "medio", "pasta|macarrones|espaguetis|espaguetti|fideos|tallarines|pasta hervida|spaguetti|penne|tirabuzones|pasta blanca|macarron|espagueti", "1 plato:220|1 ración:180"),
  F("Pasta integral cocida", "pasta", 137, 5.5, 26, 1, 4, 1.2, "bajo", "pasta integral|macarrones integrales|espaguetis integrales|espagueti integral", "1 plato:220|1 ración:180"),
  F("Macarrones con tomate", "pasta", 147, 5, 25, 4, 2, 3, "medio", "macarrones con tomate|pasta con tomate|espaguetis con tomate|macarrones con tomate y queso|macarrones con queso", "1 plato:300"),
  F("Espaguetis a la boloñesa", "plato", 161, 8, 20, 3, 2, 5.5, "medio", "espaguetis boloñesa|pasta boloñesa|macarrones con carne|espaguetis a la bolonesa|pasta a la bolonesa|boloñesa|bolonesa|espaguetis con carne", "1 plato:300"),
  F("Lasaña", "plato", 168, 9, 15, 3, 1.4, 8, "medio", "lasaña|lasana|canelones|canelon|lasaña de carne", "1 ración:300"),
  F("Ñoquis", "pasta", 148, 4, 32, 1, 1.5, 0.5, "alto", "noquis|ñoquis", "1 plato:250"),
  F("Cuscús cocido", "cereal", 109, 3.8, 23, 0.1, 1.4, 0.2, "medio", "cuscus|cous cous|cuscus cocido", "1 ración:150"),
  F("Quinoa cocida", "cereal", 119, 4.4, 21, 1, 2.8, 1.9, "bajo", "quinoa|quinua", "1 ración:150"),
  F("Patata cocida", "patata", 77, 2, 17, 0.8, 1.8, 0.1, "alto", "patata|patatas|patata hervida|patata asada|cachelos|patatas cocidas|patata al horno|puré de patata|pure de patata|papas|papa", "1 patata:150|1 ración:200"),
  F("Patatas fritas caseras", "patata", 313, 3.5, 41, 0.5, 3.8, 15, "alto", "patatas fritas|patata frita|patatas fritas caseras|papas fritas|fritas|patatas de freidora|patatas de burguer|patatas fritas de freidora", "1 ración:150"),
  F("Patatas bravas", "plato", 189, 3, 24, 1, 2.5, 9, "alto", "bravas|patatas bravas|brava|patatas alioli|patatas con alioli|patatas con salsa brava", "1 ración:200|1 tapa:120"),
  F("Patatas fritas de bolsa", "snack", 539, 6, 50, 0.5, 4.5, 35, "alto", "patatas de bolsa|patatas chips|chips|patatillas|patatas fritas de bolsa|ganchitos|snacks|cheetos|doritos|ruffles|bolsa de patatas", "1 bolsa pequeña:40|1 puñado:25"),
  F("Patatas panaderas", "patata", 112, 2, 17, 1, 2, 4.2, "alto", "patatas panaderas|patata panadera|panaderas|patatas a lo pobre|patatas al horno con aceite|patatas panadera|patatas panaderas mercadona|patatas panaderas eroski|patatas asadas con aceite|patatas al horno con cebolla", "1 ración:250|1 plato:300"),
  F("Boniato asado", "patata", 87, 1.6, 20, 6, 3, 0.1, "medio", "boniato|batata|boniato al horno|boniato cocido|camote", "1 boniato:200"),
  F("Tortilla de patatas", "plato", 171, 6.5, 10.5, 1, 1.4, 11.5, "alto", "tortilla de patata|tortilla española|tortilla|pincho de tortilla|tortilla de patatas con cebolla|tortilla de patatas sin cebolla|tortilla con cebolla", "1 ración:150|1 pincho:120|1 porción:150"),
  // ---- Platos y bocadillos ----
  F("Pizza", "plato", 258, 11, 32, 3, 2, 9.5, "alto", "pizza|pizza margarita|pizza de queso|pizza barbacoa|pizza cuatro quesos|pizza de jamon y queso|pizza congelada|pizza de pepperoni|pizza fresca", "1 pizza individual:350|1 porción:110"),
  F("Bocadillo de jamón", "plato", 268, 13, 36, 2, 2, 8, "alto", "bocadillo de jamon|bocata de jamon|bocadillo de jamon serrano|pulga de jamon|bocadillo de york|bocadillo jamon|bocadillo de jamon y queso|bocata jamon|bocata de jamon y queso|bocadillo de queso|bocadillo de pavo|bocadillo|bocata", "1 bocadillo:200|1 pulga:100"),
  F("Bocadillo de tortilla", "plato", 235, 8, 26, 1, 2, 11, "alto", "bocadillo de tortilla|bocata de tortilla|bocadillo de tortilla de patata|pincho de tortilla en pan", "1 bocadillo:230"),
  F("Bocadillo de lomo con queso", "plato", 288, 17, 28, 1, 1.5, 12, "alto", "bocadillo de lomo|bocata de lomo|bocadillo de lomo con queso|bocadillo de pollo|bocata de pollo|bocadillo de calamares|bocadillo de panceta", "1 bocadillo:220"),
  F("Sándwich mixto", "plato", 267, 13, 28, 3, 1.5, 11.5, "alto", "sandwich mixto|sandwich de jamon y queso|sandwich|sandwich de pavo|sandwich vegetal|tostada mixta|sandwich de york y queso|sandwich de jamon", "1 sándwich:130"),
  F("Hamburguesa completa", "plato", 252, 13, 22, 4, 1.8, 12.5, "alto", "hamburguesa completa|hamburguesa con pan|hamburguesa de restaurante|hamburguesa de fast food|cheeseburger|big mac|whopper|hamburguesa con queso|hamburguesa con patatas", "1 hamburguesa:200"),
  F("Empanada de atún", "plato", 252, 9, 26, 2, 1.5, 12.5, "medio", "empanada|empanada gallega|empanada de atun|empanada de carne|empanada de zamburiñas|empanada de bonito|empanada de pollo|empanada de xoubas|empanada de bacalao", "1 trozo:150"),
  F("Empanadilla frita", "plato", 297, 8, 28, 1, 1, 17, "alto", "empanadilla|empanadillas|empanadillas fritas|pastel de carne", "1 empanadilla:70"),
  F("Croquetas", "plato", 221, 7, 19, 1.5, 1.0, 13, "alto", "croqueta|croquetas|croquetas de jamon|croquetas de pollo|croquetas caseras|croquetas de bacalao|croquetas de cocido", "1 croqueta:30|1 ración:150"),
  F("Sushi", "plato", 150, 6, 28, 4, 0.8, 1.5, "alto", "sushi|maki|nigiri|sushi variado|sashimi con arroz|california roll", "1 pieza:30|1 ración:200"),
  F("Ensaladilla rusa", "plato", 189, 3.5, 9, 2, 1.5, 15.5, "medio", "ensaladilla|ensaladilla rusa|ensaladilla de atun", "1 ración:150|1 tapa:100"),
  F("Ensalada de pasta o arroz", "plato", 150, 5, 18, 2, 1.5, 6.5, "medio", "ensalada de pasta|ensalada de arroz|ensalada de arroz y atun|ensalada de pasta con atun|ensalada campera|ensalada de cuscus|ensalada de patata", "1 plato:250|1 bol:250"),
  F("Ensalada de legumbres", "plato", 120, 6, 14, 1.5, 4.5, 4.5, "bajo", "ensalada de garbanzos|ensalada de legumbres|ensalada de lentejas|ensalada de alubias|ensalada de judias", "1 plato:250|1 bol:250"),
  F("Ensalada César", "plato", 154, 9, 6, 2, 1.5, 10.5, "bajo", "ensalada cesar|cesar|ensalada de pollo|ensalada con pollo|ensalada completa", "1 plato:250"),
  F("Pisto", "plato", 70, 1.5, 7, 5, 2, 4, "bajo", "pisto|ratatouille|pisto manchego|pisto con huevo|menestra de verduras|alboronia", "1 ración:200"),
  F("Pimientos de Padrón", "verdura", 78, 2, 3, 2, 2, 6.5, "bajo", "pimientos de padron|padron|pimientos fritos|pimientos de padron fritos|pementos|pimientos a la plancha|pimientos asados", "1 ración:120"),
  // ---- Verdura y ensalada ----
  F("Ensalada mixta", "verdura", 20, 1, 3, 2, 1.2, 0.2, "bajo", "ensalada|ensalada mixta|ensalada verde|ensalada de lechuga y tomate|ensalada de tomate|ensalada sin aliñar|plato de ensalada|ensalada con tomate|ensalada de lechuga|ensalada simple", "1 plato:200|1 bol:150"),
  F("Lechuga y hojas verdes", "verdura", 14, 1.2, 2, 1, 1.5, 0.2, "bajo", "lechuga|canonigos|rucula|mezclum|hojas verdes|brotes|escarola|lechuga romana|ensalada de brotes|bolsa de ensalada|lechuga iceberg", "1 plato:80|1 puñado:30"),
  F("Tomate", "verdura", 20, 0.9, 3.5, 2.6, 1.2, 0.2, "bajo", "tomates|tomate natural|tomate en rodajas|tomate cherry|tomate rallado|tomate crudo|tomates cherry|tomate aliñado", "1 tomate:150|1 rodaja:20"),
  F("Tomate frito", "salsa", 82, 1.5, 10, 8, 1.5, 4, "bajo", "salsa de tomate|tomate frito|sofrito|tomate triturado|tomate frito casero|salsa de tomate casera", "1 cucharada:25|1 ración:60"),
  F("Pepino", "verdura", 11, 0.7, 1.8, 1.5, 0.5, 0.1, "bajo", "pepinos|pepino en ensalada|pepinillo fresco", "1 pepino:200"),
  F("Zanahoria", "verdura", 33, 0.9, 7, 5, 2.8, 0.2, "bajo", "zanahorias|zanahoria cruda|zanahoria cocida|palitos de zanahoria|zanahoria rallada", "1 zanahoria:80"),
  F("Cebolla", "verdura", 34, 1.2, 7, 5, 1.7, 0.1, "bajo", "cebollas|cebolla cruda|cebolla pochada|cebolla frita|cebolleta", "1 cebolla:100"),
  F("Pimiento", "verdura", 25, 1, 4.5, 3.5, 1.5, 0.3, "bajo", "pimientos|pimiento rojo|pimiento verde|pimiento crudo|pimientos asados|pimiento del piquillo|pimientos del piquillo", "1 pimiento:150"),
  F("Brócoli", "verdura", 28, 3, 3, 1.5, 3, 0.4, "bajo", "brocoli|brocoli cocido|brocoli al vapor|brecol|romanesco", "1 ración:150|1 plato:200"),
  F("Coliflor", "verdura", 22, 2, 2.5, 2, 2.5, 0.3, "bajo", "coliflor cocida|coliflor al vapor|coliflor hervida|coliflor", "1 ración:150|1 plato:200"),
  F("Espinacas", "verdura", 28, 3, 3.5, 0.4, 2.5, 0.5, "bajo", "espinaca|espinacas cocidas|espinacas frescas|espinacas salteadas|espinacas a la crema", "1 ración:150|1 puñado:30"),
  F("Judías verdes", "verdura", 30, 1.8, 5, 2, 3, 0.3, "bajo", "judias verdes|judias|vainas|judias verdes cocidas|judias verdes con patata|judias verdes con jamon|habichuelas", "1 plato:200|1 ración:150"),
  F("Calabacín", "verdura", 17, 1.5, 2, 1.8, 1, 0.3, "bajo", "calabacin|calabacines|calabacin a la plancha|calabacin salteado", "1 calabacín:200|1 ración:150"),
  F("Berenjena", "verdura", 25, 1, 5, 3, 3, 0.2, "bajo", "berenjenas|berenjena a la plancha|berenjena asada|berenjena al horno", "1 berenjena:250|1 ración:150"),
  F("Champiñones", "verdura", 22, 3, 2.5, 0.5, 1.5, 0.3, "bajo", "champinones|champiñon|setas|champiñones a la plancha|champiñones salteados|champis|setas a la plancha|hongos|portobello", "1 ración:100|1 plato:150"),
  F("Verdura variada", "verdura", 38, 2.5, 6, 3, 3, 0.5, "bajo", "verdura|verduras|menestra|verdura congelada|verduras salteadas|verdura salteada|verduras al vapor|verduras cocidas|verdura cocida|verduras congeladas|verdura al vapor|salteado de verduras|wok de verduras|menestra de verduras|ensalada de verdura cocida|verdura hervida|verduras hervidas", "1 plato:250|1 ración:200"),
  F("Verduras a la plancha", "verdura", 59, 1.8, 5, 3, 2.5, 3.5, "bajo", "verduras a la plancha|verdura a la plancha|verduras asadas|parrillada de verduras|verduras al horno|escalivada|verduras a la parrilla|parrillada", "1 plato:200"),
  F("Crema de verduras", "verdura", 45, 1.2, 6, 2.5, 1.5, 1.8, "bajo", "crema|crema de calabacin|crema de calabaza|pure de verduras|puré de verduras|crema de verdura|pure|crema de puerros|crema de champiñones|crema de zanahoria|crema de verduras casera|pure de calabaza", "1 plato:300|1 bol:250"),
  F("Gazpacho", "verdura", 45, 0.9, 4, 3, 1, 2.8, "bajo", "gazpacho|gazpacho andaluz|gazpacho de bote|gazpacho mercadona", "1 vaso:250|1 bol:300"),
  F("Salmorejo", "verdura", 100, 2.5, 8, 3, 1, 6.5, "medio", "salmorejo|salmorejo cordobes", "1 plato:300|1 bol:300"),
  F("Sopa de fideos", "verdura", 31, 2, 4, 0.3, 0.3, 0.8, "medio", "sopa|sopa de pollo|sopa de fideos|sopa de cocido|sopa de pasta|sopa de verduras|sopa de ave|sopa de picadillo|sopa castellana", "1 plato:300"),
  F("Caldo gallego", "plato", 41, 2.5, 4.5, 0.8, 1.5, 1.5, "bajo", "caldo gallego|caldo con grelos|caldo de berza|caldo de verduras con patata|caldo con verduras|caldo con patata", "1 plato:350|1 bol:300"),
  F("Caldo de pollo", "verdura", 9, 1, 0.5, 0, 0, 0.3, "bajo", "caldo|caldo de ave|caldo de verduras|caldito|caldo casero|consome", "1 taza:200"),
  F("Aguacate", "verdura", 160, 2, 8.5, 0.7, 6.7, 15, "bajo", "aguacate|aguacates|guacamole|medio aguacate", "1 aguacate:120"),
  F("Aceitunas", "grasa", 139, 1, 3.5, 0.3, 3, 14.5, "bajo", "aceituna|aceitunas verdes|aceitunas negras|olivas|aceitunas rellenas|olivas verdes", "1 puñado:30|1 ración:40|1 aceituna:4"),
  F("Pepinillos y encurtidos", "verdura", 12, 0.5, 2, 1, 1, 0.2, "bajo", "pepinillos|encurtidos|pepinillo|cebolletas en vinagre|banderillas|guindillas|piparras", "1 puñado:30"),
  F("Maíz dulce", "verdura", 88, 3, 16, 4, 2.5, 1.3, "medio", "maiz|maiz dulce|maiz en lata|lata de maiz|mazorca|maiz cocido", "1 lata:140|1 cucharada:20"),
  F("Espárragos", "verdura", 18, 2, 2, 1.5, 1.5, 0.2, "bajo", "esparragos|esparragos trigueros|esparrago|esparragos blancos|esparragos verdes|esparragos a la plancha", "1 ración:150"),
  F("Alcachofas", "verdura", 32, 2.5, 5, 1, 5, 0.2, "bajo", "alcachofa|alcachofas cocidas|alcachofas a la plancha|alcachofas de bote|corazones de alcachofa", "1 ración:150"),
  F("Remolacha cocida", "verdura", 42, 1.7, 8.5, 7, 2, 0.1, "medio", "remolacha|remolacha cocida|remolachas|betabel", "1 ración:100"),
  F("Calabaza", "verdura", 25, 1, 5, 3, 1, 0.1, "medio", "calabaza asada|calabaza cocida|calabaza|zapallo", "1 ración:150"),
  F("Puerro", "verdura", 31, 2, 5, 3, 2.5, 0.3, "bajo", "puerros|puerro cocido|puerros a la plancha", "1 puerro:150"),
  F("Acelgas", "verdura", 19, 1.8, 2.5, 1, 1.5, 0.2, "bajo", "acelga|acelgas cocidas|acelgas con patata|grelos|nabizas|berza|repollo|col|col rizada|repollo cocido|berzas|lombarda", "1 plato:200|1 ración:150"),
  // ---- Frutas ----
  F("Manzana", "fruta", 51, 0.3, 12, 10.4, 2.4, 0.2, "bajo", "manzanas|manzana verde|manzana roja|manzana golden|manzana asada|manzana al horno|fuji|granny smith", "1 manzana:180"),
  F("Pera", "fruta", 52, 0.4, 12.5, 9.5, 3.1, 0.1, "bajo", "peras|pera conferencia|pera de agua", "1 pera:180"),
  F("Naranja", "fruta", 44, 0.9, 9.5, 8.5, 2.2, 0.2, "bajo", "naranjas|naranja entera|gajos de naranja|pomelo|naranja de mesa", "1 naranja:150"),
  F("Mandarina", "fruta", 45, 0.7, 10, 9, 1.8, 0.2, "bajo", "mandarinas|clementinas|clementina|satsuma", "1 mandarina:80"),
  F("Plátano", "fruta", 88, 1.2, 20, 16, 2, 0.3, "medio", "platano|platanos|banana|bananas|platano de canarias", "1 plátano:120"),
  F("Uvas", "fruta", 70, 0.7, 16.5, 15, 1.0, 0.2, "medio", "uva|racimo de uvas|uvas blancas|uvas negras", "1 racimo:150|1 puñado:80"),
  F("Fresas", "fruta", 30, 0.7, 6, 5, 2, 0.3, "bajo", "fresa|fresas|fresones|freson|fresas con nata", "1 bol:150|1 puñado:80"),
  F("Kiwi", "fruta", 49, 1, 10, 9, 2.5, 0.5, "bajo", "kiwis|kiwi verde|kiwi amarillo", "1 kiwi:80"),
  F("Melón", "fruta", 30, 0.8, 6.5, 6, 0.8, 0.1, "medio", "melon|melon piel de sapo|cantalupo|melon con jamon|tajada de melon", "1 tajada:200|1 ración:150"),
  F("Sandía", "fruta", 31, 0.6, 7, 6, 0.5, 0.1, "alto", "sandia|tajada de sandia|sandias", "1 tajada:250"),
  F("Melocotón", "fruta", 39, 0.9, 8.5, 8, 1.5, 0.1, "bajo", "melocotones|melocoton|paraguayo|nectarina|durazno|nectarinas|paraguayos", "1 melocotón:150"),
  F("Albaricoque", "fruta", 40, 0.8, 8.5, 8, 2, 0.1, "bajo", "albaricoques|albaricoque|ciruela|ciruelas|damasco", "1 albaricoque:40|1 ciruela:50"),
  F("Cerezas", "fruta", 58, 1, 13, 11, 1.5, 0.2, "bajo", "cereza|cerezas|picotas|guindas", "1 puñado:80|1 ración:150"),
  F("Piña", "fruta", 49, 0.5, 11.5, 10, 1.4, 0.1, "medio", "pina|rodaja de pina|pina natural|pina fresca", "1 rodaja:80|1 ración:150"),
  F("Mango", "fruta", 63, 0.8, 14, 13, 1.8, 0.4, "medio", "mango|papaya|mangos", "1 mango:200|1 ración:150"),
  F("Frutos rojos", "fruta", 44, 0.7, 9.5, 7, 3, 0.3, "bajo", "arandanos|frambuesas|moras|frutos del bosque|frutos rojos|arandano|frambuesa|grosellas|mora", "1 puñado:80|1 bol:120"),
  F("Higos", "fruta", 66, 0.8, 15, 14, 2, 0.3, "medio", "higo|higos|brevas|breva", "1 higo:50"),
  F("Granada", "fruta", 78, 1.2, 16, 14, 3.5, 1, "bajo", "granada|granadas", "1 granada:150"),
  F("Pieza de fruta", "fruta", 50, 0.7, 11.5, 10, 2, 0.2, "bajo", "fruta|una fruta|fruta fresca|fruta de postre|fruta de temporada|pieza de fruta|postre de fruta|fruta entera", "1 pieza:150"),
  F("Macedonia de fruta", "fruta", 50, 0.6, 11.5, 10, 1.5, 0.2, "medio", "macedonia|ensalada de frutas|fruta variada|fruta troceada|frutas|plato de fruta|fruta cortada|bol de fruta", "1 bol:200"),
  F("Fruta en almíbar", "fruta", 70, 0.4, 17, 16, 1, 0.1, "alto", "fruta en almibar|melocoton en almibar|piña en almibar|peras en almibar|fruta en conserva|almibar", "1 ración:120"),
  F("Dátiles", "fruta", 278, 2.5, 66, 63, 7, 0.4, "medio", "datiles|datil|dátil|datiles medjool|pasas|pasas de uvas|uvas pasas|orejones|ciruelas pasas", "1 dátil:8|1 puñado:30"),
  F("Zumo de naranja", "bebida", 44, 0.7, 10, 8.7, 0.2, 0.2, "alto", "zumo|zumo de naranja|zumo natural|zumo de fruta|jugo|zumo de piña|zumo de melocoton|zumo de manzana|zumo envasado|zumo exprimido|zumo de uva|nectar", "1 vaso:200"),
  // ---- Frutos secos, grasas y salsas ----
  F("Almendras", "frutos secos", 576, 21, 14, 4, 12, 52, "bajo", "almendra|almendras tostadas|almendras crudas|almendras naturales", "1 puñado:25|1 almendra:1.2|1 cucharada:12"),
  F("Nueces", "frutos secos", 655, 15, 7, 3, 7, 63, "bajo", "nuez|nueces|nueces peladas", "1 puñado:25|1 nuez:6"),
  F("Cacahuetes", "frutos secos", 594, 26, 10, 4, 8, 50, "bajo", "cacahuete|cacahuetes|cacahuetes tostados|cacahuetes fritos|mani|cacahuetes salados", "1 puñado:30"),
  F("Pistachos", "frutos secos", 558, 20, 16, 8, 10, 46, "bajo", "pistacho|pistachos|pistachos tostados", "1 puñado:30"),
  F("Avellanas", "frutos secos", 642, 15, 17, 4, 10, 62, "bajo", "avellana|avellanas|avellanas tostadas", "1 puñado:30"),
  F("Anacardos", "frutos secos", 606, 18, 30, 6, 3, 46, "bajo", "anacardo|anacardos|anacardos tostados", "1 puñado:30"),
  F("Frutos secos variados", "frutos secos", 602, 19, 10, 4, 8, 54, "bajo", "frutos secos|mezcla de frutos secos|frutos secos variados|fruto seco|bolsita de frutos secos|cocktail de frutos secos|mix de frutos secos", "1 puñado:30|1 bolsita:30"),
  F("Pipas de girasol", "frutos secos", 596, 21, 20, 3, 9, 48, "bajo", "pipas|pipas de girasol|pipas peladas|semillas de girasol|semillas de calabaza|pipas de calabaza|semillas", "1 puñado:30"),
  F("Semillas de chía", "frutos secos", 486, 16, 42, 0, 34, 31, "bajo", "chia|semillas de chia|semillas de lino|lino|linaza|sesamo|semillas de sesamo", "1 cucharada:12"),
  F("Crema de cacahuete", "grasa", 598, 25, 12, 6, 6, 50, "bajo", "mantequilla de cacahuete|crema de cacahuete|crema de cacahuetes|peanut butter|crema de almendras|crema de frutos secos", "1 cucharada:15|1 cucharadita:5"),
  F("Aceite de oliva", "grasa", 900, 0, 0, 0, 0, 100, "bajo", "aceite|aove|aceite de oliva virgen extra|chorrito de aceite|aceite de oliva|chorro de aceite|aceite de girasol|un chorrito de aceite|hilo de aceite|aliño|alino|vinagreta", "1 cucharada:10|1 cucharadita:4|1 chorrito:5"),
  F("Mantequilla", "grasa", 743, 0.7, 0.6, 0.6, 0, 82, "bajo", "mantequilla|margarina|manteca|mantequilla con pan", "1 cucharadita:5|1 porción:10|1 cucharada:15"),
  F("Mayonesa", "salsa", 687, 1, 2, 1, 0, 75, "bajo", "mayonesa|mahonesa|alioli|salsa alioli|salsa rosa|salsa cesar|salsa de yogur", "1 cucharada:15|1 sobre:12"),
  F("Kétchup", "salsa", 110, 1.2, 26, 22, 0.5, 0.1, "medio", "ketchup|catsup|kétchup|salsa barbacoa|salsa agridulce|salsa brava", "1 cucharada:17"),
  F("Salsa de soja", "salsa", 55, 8, 5, 1, 0, 0, "bajo", "salsa de soja|soja salsa|salsa de soja baja en sal|tamari", "1 cucharada:15"),
  F("Pesto", "salsa", 445, 5, 5, 2, 2, 45, "bajo", "pesto|salsa pesto|pesto genoves|salsa pesto rojo", "1 cucharada:15"),
  F("Mermelada", "dulce", 250, 0.4, 62, 58, 1, 0.1, "alto", "mermelada|confitura|mermelada de fresa|mermelada de melocoton|mermelada de naranja|dulce de membrillo|membrillo|mermelada sin azucar", "1 cucharada:15|1 cucharadita:5"),
  F("Miel", "dulce", 300, 0.4, 80, 78, 0, 0, "alto", "miel|miel de abeja|sirope|sirope de arce|sirope de agave|melaza", "1 cucharada:20|1 cucharadita:7"),
  F("Azúcar", "dulce", 400, 0, 100, 100, 0, 0, "alto", "azucar|azucar blanco|azucar moreno|sobre de azucar|terron de azucar|azucarillo|sacarina", "1 cucharadita:5|1 sobre:6|1 terrón:5|1 cucharada:15"),
  F("Cola Cao", "dulce", 359, 5, 78, 70, 5, 3, "alto", "colacao|cola cao|cacao soluble|nesquik|cacao en polvo|cacaolat|cacao|cacao en polvo con azucar|nutribén", "1 ración:15|1 cucharada:10|1 cucharadita:5"),
  F("Crema de cacao", "dulce", 531, 6, 57, 56, 3, 31, "alto", "nutella|crema de cacao|crema de chocolate|nocilla|crema de avellanas|nocilla con pan", "1 cucharada:15|1 cucharadita:5"),
  F("Chocolate negro", "dulce", 521, 8, 30, 24, 11, 41, "medio", "chocolate negro|chocolate 85|chocolate 70|chocolate puro|chocolate sin azucar|chocolate amargo|onza de chocolate negro", "1 onza:10|1 ración:20"),
  F("Chocolate con leche", "dulce", 539, 7, 58, 55, 2, 31, "alto", "chocolate|chocolate con leche|onza de chocolate|tableta de chocolate|bombon|bombones|chocolatina|barrita de chocolate|kit kat|snickers|twix|lacasitos", "1 onza:10|1 tableta:100|1 chocolatina:25"),
  F("Tarta de queso", "dulce", 291, 6, 24, 18, 0.5, 19, "alto", "tarta de queso|cheesecake|tarta|pastel|tarta de la abuela|porcion de tarta|tarta de chocolate|pastel de queso|trozo de tarta|tarta de cumpleaños", "1 porción:120"),
  F("Tarta de Santiago", "dulce", 426, 10, 38, 28, 3, 26, "alto", "tarta de santiago|torta de santiago|torta|bizcocho de almendra|bica", "1 porción:80"),
  F("Gominolas", "dulce", 333, 6, 77, 50, 0, 0.1, "alto", "gominolas|chuches|caramelos|gusanitos|regaliz|chicles|golosinas|caramelo|dulces", "1 puñado:30"),
  // ---- Snacks y suplementos ----
  F("Palomitas", "snack", 452, 9, 50, 0.5, 9, 24, "medio", "palomitas|palomitas de microondas|palomitas de maiz|palomitas de cine|pop corn", "1 bolsa:100|1 puñado:20"),
  F("Barrita de cereales", "snack", 394, 6, 70, 28, 5, 10, "alto", "barrita de cereales|barrita|barrita de muesli|barrita de fruta|barritas|barrita energetica|barritas de cereales", "1 barrita:25"),
  F("Barrita de proteínas", "snack", 362, 33, 35, 5, 5, 10, "medio", "barrita proteica|barrita de proteinas|barrita de proteina|barrita high protein|barritas de proteinas|protein bar", "1 barrita:45"),
  F("Proteína en polvo", "suplemento", 390, 78, 6, 3, 0, 6, "bajo", "whey|proteina en polvo|batido de proteinas|batido de proteina|scoop|proteina|cacito de proteina|proteina whey|shaker|batido proteico", "1 cacito:30|1 scoop:30"),
  // ---- Bebidas ----
  F("Agua", "bebida", 0, 0, 0, 0, 0, 0, "bajo", "agua con gas|agua mineral|soda|sifon|agua con limon|agua del grifo|agua natural|botella de agua|agua con burbujas|agua con gas y limon|seltzer|agua fria", "1 vaso:200|1 botella:500"),
  F("Café solo", "bebida", 2, 0.1, 0, 0, 0, 0, "bajo", "cafe|cafe solo|americano|cafe americano|expreso|espresso|cafe descafeinado|descafeinado|cafe con hielo|cafe solo sin azucar|cafe negro", "1 café:50|1 taza:150"),
  F("Café con leche", "bebida", 25, 1.6, 2.4, 2.4, 0, 1, "bajo", "cafe con leche|cortado|capuchino|latte|cafe cortado|cafe con leche descafeinado|cafelito|cafe manchado|manchado|leche manchada|cappuccino", "1 café con leche:200|1 taza:200|1 vaso:250"),
  F("Té o infusión", "bebida", 1, 0, 0.2, 0, 0, 0, "bajo", "te|infusion|manzanilla|poleo|tila|te verde|te negro|infusion de frutas|rooibos|poleo menta|te con limon|te rojo|infusiones|tisana|te frio sin azucar", "1 taza:200"),
  F("Refresco azucarado", "bebida", 42, 0, 10.6, 10.6, 0, 0, "alto", "refresco|coca cola|cocacola|coca-cola|fanta|kas|casera|refresco de cola|refresco de naranja|pepsi|sprite|refresco de limon|nestea|aquarius|refrescos|bebida azucarada|limonada|fanta naranja|trina|schweppes|tonica azucarada", "1 lata:330|1 vaso:200|1 botellín:200"),
  F("Refresco sin azúcar", "bebida", 1, 0, 0, 0, 0, 0, "bajo", "coca cola zero|cocacola zero|refresco zero|refresco light|coca cola light|pepsi max|refresco sin azucar|zero|fanta zero|sprite zero|coca zero|refresco cero|bebida zero|tonica zero|nestea zero|aquarius zero|tonica sin azucar", "1 lata:330|1 vaso:200"),
  F("Agua tónica", "bebida", 34, 0, 8.5, 8.5, 0, 0, "alto", "tonica|agua tonica|schweppes tonica", "1 botellín:200"),
  F("Batido de chocolate", "bebida", 65, 3.2, 10, 9.5, 0.3, 1.3, "medio", "batido|batido de chocolate|batido de cacao|batido de fresa|batido de vainilla|batido de leche|cacaolat|batido envasado|batidos", "1 brick:200"),
  F("Chocolate a la taza", "bebida", 129, 3, 18, 15, 1, 5, "alto", "chocolate caliente|chocolate a la taza|chocolate con leche caliente|chocolate espeso|chocolate desayuno", "1 taza:150"),
  F("Bebida energética", "bebida", 44, 0, 11, 11, 0, 0, "alto", "red bull|monster|bebida energetica|energetica|burn|redbull|bebida isotonica|isotonica|gatorade|powerade", "1 lata:250"),
  F("Cerveza", "bebida", 43, 0.4, 3.6, 0, 0, 0, "medio", "cerveza|caña|cañas|tercio|birra|cerveza con alcohol|cana|canas|botellin|botellin de cerveza|jarra de cerveza|pinta|doble|cerveza rubia|cerveza negra|cerveza tostada|clara|clara con limon|shandy|mahou|estrella galicia|estrella|alhambra|san miguel|cruzcampo|damm|voll damm|1906", "1 caña:200|1 botellín:200|1 tercio:330|1 jarra:400|1 pinta:500", 3.9),
  F("Cerveza sin alcohol", "bebida", 19, 0.3, 4.5, 2, 0, 0, "medio", "cerveza sin|caña sin|cerveza sin alcohol|cerveza 0|cerveza 0,0|cerveza 00|sin alcohol|cerveza cero|cerveza 0 0|cerveza sin alcohol 0,0|cerveza 0.0", "1 botellín:200|1 tercio:330"),
  F("Vino", "bebida", 80, 0.1, 2, 0.5, 0, 0, "bajo", "vino tinto|vino blanco|copa de vino|rioja|ribeiro|albariño|albarino|vino|ribera|mencia|godello|tinto|tinto de verano|vino rosado|cava|champan|champagne|vino de la casa|cosecha|crianza|reserva|rosado|vermut|vermu|vermouth|vino dulce|oporto", "1 copa:150|1 vaso:200", 9.5),
  F("Sidra", "bebida", 43, 0, 3, 2.5, 0, 0, "bajo", "sidra|sidra natural|sidra asturiana|sidra gallega|sidra dulce|sidra achampanada", "1 vaso:200|1 botella:700", 4.5),
  F("Destilado", "bebida", 231, 0, 0, 0, 0, 0, "bajo", "whisky|ron|ginebra|vodka|licor|chupito|orujo|aguardiente|brandy|coñac|conac|tequila|anis|pacharan|licor cafe|licor de hierbas|digestivo|chupitos|licor 43|ron solo|whiskey|aguardiente de hierbas|queimada", "1 chupito:40|1 copa:50", 33),
  F("Combinado", "bebida", 75, 0, 7, 7, 0, 0, "alto", "gin tonic|cubata|ron con cola|whisky con cola|combinado|copa|gintonic|mojito|cuba libre|vodka con naranja|copazo|copas|cubalibre|ginebra con tonica|gin|caipirinha|margarita|piña colada|daiquiri|sangria|sangria de vino|sangría", "1 copa:250", 7),
  // ---- Más platos, guisos y productos ----
  F("Seitán", "legumbre", 130, 24, 4, 0.5, 1, 2, "bajo", "seitan|proteina de trigo|vegetal de trigo", "1 ración:120"),
  F("Edamame", "legumbre", 125, 11, 9, 2, 5, 5, "bajo", "edamame|soja verde|habas de soja", "1 ración:100"),
  F("Garbanzos tostados", "snack", 352, 20, 50, 8, 15, 8, "bajo", "garbanzos tostados|garbanzos crujientes|snack de garbanzos", "1 puñado:30"),
  F("Hígado encebollado", "carne", 158, 22, 3, 1, 0.5, 6.5, "bajo", "higado|higado de ternera|higado encebollado|higado de pollo", "1 ración:150"),
  F("Callos", "plato", 130, 16, 2, 0.5, 0.3, 6.5, "bajo", "callos|callos a la madrileña|callos con garbanzos", "1 plato:300"),
  F("Morcilla", "embutido", 384, 14, 10, 1, 1, 32, "bajo", "morcilla|morcilla de burgos|morcilla de arroz|morcilla de cebolla", "1 rodaja:30|1 ración:80"),
  F("Mortadela", "embutido", 312, 12, 3, 1, 0, 28, "bajo", "mortadela|chopped|fiambre de cerdo|queso de cerdo|cabeza de jabali|paté|pate|foie", "1 loncha:20"),
  F("Cecina", "embutido", 197, 38, 0, 0, 0, 5, "bajo", "cecina|cecina de leon|cecina de vaca|bresaola|cecina de buey", "1 loncha:15|1 ración:50"),
  F("Queso feta", "lacteo", 261, 14, 4, 4, 0, 21, "bajo", "feta|queso griego|queso feta|queso halloumi|halloumi", "1 cuña:30|1 ración:50"),
  F("Queso azul", "lacteo", 349, 21, 1, 0.5, 0, 29, "bajo", "queso azul|cabrales|roquefort|gorgonzola|queso con moho", "1 cuña:30"),
  F("Queso de cabra", "lacteo", 327, 20, 1, 0.5, 0, 27, "bajo", "queso de cabra|rulo de cabra|queso de oveja|queso de cabra a la plancha|queso fundido|queso brie|camembert|brie|queso cremoso", "1 cuña:30|1 ración:50"),
  F("Leche condensada", "dulce", 333, 8, 55, 55, 0, 9, "alto", "leche condensada|condensada", "1 cucharada:20"),
  F("Yogur bebible", "lacteo", 70, 3, 11, 10, 0, 1.5, "medio", "yogur liquido|yogur bebible|actimel|yakult|yogur para beber|bebida de yogur|danacol|lactobacilos", "1 botella:100|1 botella grande:200"),
  F("Cuajada", "lacteo", 90, 5, 5, 5, 0, 5.5, "bajo", "cuajada|mato|requeson de leche|cuajada con miel", "1 tarrina:125"),
  F("Quesitos", "lacteo", 244, 10, 6, 4, 0, 20, "bajo", "quesitos|queso en porciones|la vaca que rie|el caserio|queso fundido en porciones|quesito|babybel|mini babybel", "1 porción:17"),
  F("Tortitas americanas", "bolleria", 233, 6, 32, 6, 1, 9, "alto", "pancakes|tortitas americanas|tortitas con sirope|tortitas de avena|crepes|crepe|creps|tortitas dulces", "1 tortita:50"),
  F("Gofre", "bolleria", 293, 6, 38, 12, 1, 13, "alto", "gofre|waffle|gofres|barquillo", "1 gofre:75"),
  F("Torrija", "bolleria", 248, 7, 28, 12, 1, 12, "alto", "torrija|torrijas|pan frito|leche frita|torrijas de semana santa", "1 torrija:80"),
  F("Bizcocho", "bolleria", 333, 6, 48, 24, 1, 13, "alto", "bizcocho|bizcocho casero|bizcocho de yogur|plumcake|pastel casero|bizcocho de limon|bizcocho de chocolate|bundt|brownie|muffin|cupcake", "1 trozo:60"),
  F("Turrón", "dulce", 500, 12, 50, 45, 3, 28, "alto", "turron|turron de almendra|turron blando|turron duro|mazapan|marron glace|peladillas|barra de turron|turron de chocolate|turron de yema|figuritas de mazapan", "1 onza:25|1 trozo:25"),
  F("Polvorón", "dulce", 514, 6, 55, 28, 1.5, 30, "alto", "polvoron|mantecado|polvorones|mantecados|dulces de navidad|dulce navideño|neulas|roscos|rosco", "1 polvorón:30"),
  F("Roscón de Reyes", "bolleria", 336, 7, 50, 20, 1.5, 12, "alto", "roscon|roscon de reyes|rosca|brioche|bollo de leche|pan de leche|ensaimada|panettone|pan dulce", "1 porción:100"),
  F("Gambas al ajillo", "plato", 149, 17, 1, 0, 0, 8.5, "bajo", "gambas al ajillo|gambas con ajo|langostinos al ajillo|camarones|gambas a la gabardina", "1 ración:150"),
  F("Mejillones en escabeche", "pescado", 119, 12, 2, 0.5, 0, 7, "bajo", "mejillones en escabeche|mejillones de lata|berberechos en lata|zamburiñas|navajas|mejillones al vapor", "1 lata:70"),
  F("Merluza en salsa verde", "plato", 100, 13, 3, 0.5, 0.5, 4, "bajo", "merluza en salsa|merluza en salsa verde|pescado en salsa|merluza con almejas|pescado guisado|bacalao con tomate|bacalao a la vizcaina|bacalao al pil pil", "1 ración:250"),
  F("Pollo al ajillo", "plato", 199, 24, 1, 0, 0, 11, "bajo", "pollo al ajillo|pollo con ajo|pollo frito|pollo en salsa|pollo al limon|pollo al curry|pollo con tomate|pollo con salsa", "1 ración:200"),
  F("Pollo guisado con patatas", "plato", 134, 12, 8, 1, 1.4, 6, "medio", "pollo guisado|pollo con patatas|guiso de pollo|pollo en pepitoria|pollo con verduras|pollo con arroz y verduras|pollo guisado con verduras", "1 plato:350"),
  F("Estofado de ternera", "plato", 130, 12, 8, 1, 1.4, 5.5, "medio", "estofado|estofado de ternera|carne guisada|ternera guisada|guiso de carne|carne con tomate|carne estofada|ternera con patatas|guiso|rabo de toro|carrilleras|carrillera|ternera en salsa|carne en salsa|cocido de carne|ossobuco|goulash|ropa vieja|carne con patatas", "1 plato:350"),
  F("Marmitako", "plato", 104, 10, 8, 1, 1, 3.5, "medio", "marmitako|guiso de atun|guiso de pescado|sopa de pescado|zarzuela|caldeirada|guiso marinero|cazuela de pescado|suquet|calderada", "1 plato:350"),
  F("Tortilla de verduras", "huevo", 129, 8, 4, 2, 1.5, 9, "bajo", "tortilla de calabacin|tortilla de espinacas|tortilla de champiñones|tortilla de verduras|tortilla de atun|tortilla de jamon|tortilla con atun|tortilla de queso|tortilla de gambas|tortilla de pimientos|tortilla de setas|tortilla rellena|tortilla de jamon y queso", "1 ración:150"),
  F("Revuelto de setas o gambas", "huevo", 142, 10, 3, 1, 1, 10, "bajo", "revuelto de setas|revuelto de gambas|revuelto de esparragos|revuelto de ajetes|revuelto de champiñones|revuelto con jamon|revuelto de verduras|revuelto de espinacas|revuelto de bacalao|revuelto de morcilla|huevos con jamon|huevos con chorizo", "1 ración:200"),
  F("Kebab", "plato", 218, 12, 20, 3, 2, 10, "alto", "kebab|durum|kebap|shawarma|doner|gyros|pita de pollo|durum de pollo|kebab de pollo", "1 kebab:300|1 durum:300"),
  F("Burrito", "plato", 203, 10, 25, 2, 3, 7, "alto", "burrito|taco|tacos|fajitas|quesadilla|enchiladas|tortilla rellena mexicana|burritos|chimichanga", "1 burrito:250"),
  F("Raviolis", "pasta", 190, 8, 26, 2, 1.5, 6, "medio", "raviolis|tortellini|pasta rellena|ravioli|tortelloni|capeletis|empanadillas de pasta|gyozas|gyoza", "1 plato:250"),
  F("Falafel", "legumbre", 342, 13, 32, 3, 5, 18, "bajo", "falafel|croquetas de garbanzo|hamburguesa vegetal|burger vegetal|hamburguesa de lentejas|hamburguesa de garbanzos|croquetas vegetales", "1 falafel:30|1 ración:120"),
  F("Atún con tomate", "pescado", 108, 13, 5, 4, 0.5, 4, "bajo", "atun con tomate|atun en tomate|lata de atun con tomate|bonito con tomate|atun a la vizcaina|atun en escabeche|atun con verduras|atun escabechado|bonito en escabeche", "1 lata:80"),
  F("Fideuá", "plato", 149, 8, 18, 1, 1, 5, "alto", "fideua|fideua de marisco|fideos a la cazuela|fideos con marisco|fideos con chorizo|arroz con costillas|arroz con verduras y conejo|arroz meloso", "1 plato:350"),
  F("Arroz con verduras", "arroz", 139, 3, 25, 2, 1.5, 3, "alto", "arroz con verduras|arroz con champiñones|arroz primavera|arroz vegetal|arroz salteado|arroz con guisantes|arroz con huevo|arroz con atun|arroz con setas|arroz con salchichas|arroz tres delicias casero", "1 plato:250"),
  F("Verduras rellenas", "plato", 128, 8, 6, 3, 2, 8, "bajo", "berenjena rellena|pimientos rellenos|calabacines rellenos|verduras rellenas|tomates rellenos|setas rellenas|champiñones rellenos|cebolla rellena|pimientos rellenos de carne|pimientos rellenos de atun|berenjenas rellenas|rollitos de berenjena", "1 ración:250"),
  F("Limón", "fruta", 31, 1, 6, 2, 2, 0.3, "bajo", "limon|limones|zumo de limon|lima|limon exprimido|limon en el agua|rodaja de limon", "1 limón:60|1 chorrito:10"),
  F("Coco", "frutos secos", 656, 6, 23, 7, 16, 60, "bajo", "coco|coco rallado|trozo de coco|leche de coco|coco fresco|aceite de coco|chips de coco", "1 cucharada:10|1 puñado:30"),
  F("Apio y rábanos", "verdura", 15, 0.8, 2.5, 1.5, 1.8, 0.2, "bajo", "apio|rabanos|rabano|palitos de apio|crudites|apio crudo|nabo|nabos|hinojo|endibias|endibia|escarola cruda|pak choi|kale", "1 ración:100"),
  F("Smoothie de frutas", "bebida", 54, 0.8, 12, 11, 1, 0.3, "medio", "smoothie|batido de fruta|batido de frutas|zumo detox|smoothie de fresa|smoothie de platano|smoothie verde|batido natural|licuado|zumo de verduras|jugo verde", "1 vaso:250"),
  F("Nachos", "snack", 475, 7, 60, 3, 5, 23, "alto", "nachos|tortillas de maiz fritas|totopos|chips de maiz|nachos con queso|tortilla chips|chips de tortilla|nachos con guacamole", "1 ración:50"),
  F("Horchata", "bebida", 72, 0.6, 14, 13, 0, 1.5, "alto", "horchata|horchata de chufa|leche de chufa|granizado|granizada|slush", "1 vaso:200"),
  F("Zumo de tomate", "bebida", 18, 0.8, 3.5, 3, 0.5, 0.1, "bajo", "zumo de tomate|jugo de tomate|bloody mary|zumo de verduras y tomate", "1 vaso:200"),
  F("Picos de pan", "pan", 392, 10, 70, 2, 3, 8, "alto", "picos|colines|rosquilletas|grissini|picos de pan|regañás|regañas|mini tostas|rosquillas saladas|palitos de pan|pan tostado fino|tostas|crackers|cracker|galletas saladas|saladitas|ritz|tosta", "1 pico:5|1 puñado:30"),
];

export const FOODS_BY_ID: Map<string, Food> = new Map(FOODS.map((f) => [f.id, f]));

/** Plural aproximado de un sustantivo de unidad (lata → latas, ración → raciones). */
export function plural(w: string): string {
  const s = w.trim();
  if (/[aeioué]$/i.test(s)) return s + "s";
  if (/ón$/i.test(s)) return s.slice(0, -2) + "ones";
  if (/z$/i.test(s)) return s.slice(0, -1) + "ces";
  return s + "es";
}
const GENERICAS = new Set(["lata", "plato", "vaso", "taza", "rebanada", "tostada", "ración", "puñado", "loncha", "filete", "cucharada", "cucharadita", "cuña", "trozo", "bol", "porción", "tajada", "bote", "brick", "bolsa", "tarrina", "rodaja", "cuenco", "botellín", "caña", "copa", "jarra", "tercio", "pinta", "pincho", "barra", "pan", "bolsita", "lata grande", "envase", "racimo", "botella", "chupito", "sobre", "terrón", "cacito", "scoop", "bola", "tapa", "chorrito", "tortilla", "unidad", "lomo", "café", "bolsa pequeña", "pizza individual", "pulga"]);

/** Nombre corto en minúscula sin paréntesis. */
export function nombreCorto(f: Food): string {
  return f.n.replace(/\s*\(.*?\)\s*/g, " ").trim().toLowerCase().replace(/\s+cocid[oa]s?$/, "");
}

function pluralNombre(nombre: string): string {
  const [w0, ...rest] = nombre.split(" ");
  return [plural(w0), ...rest].join(" ");
}

const NUMW = ["cero", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"];
const esFem = (noun: string): boolean => /(a|ión)$/i.test(noun.trim().split(" ")[0]);
function cuenta(n: number, noun: string): string {
  const fm = esFem(noun);
  if (n === 0.5) return fm ? "media" : "medio";
  if (n % 1) return String(n).replace(".", ",");
  if (n === 1) return fm ? "una" : "un";
  return n <= 10 ? NUMW[n] : String(n);
}
function pluralNoun(noun: string): string {
  const [w0, ...rest] = noun.split(" ");
  return [plural(w0), ...rest].join(" ");
}

/** Una ración concreta en palabras de casa: «media rebanada de pan», «dos huevos». */
function textoRacion(f: Food, r: Racion, medio: number): string {
  const nombre = nombreCorto(f);
  const sing = r.sing;
  const plur = medio > 1;
  const noun = plur ? pluralNoun(sing) : sing;
  if (!GENERICAS.has(sing.toLowerCase())) {
    const primera = nombre.split(" ")[0];
    const mismo = norm(primera).startsWith(norm(sing).slice(0, 4)) || norm(sing).startsWith(norm(primera).slice(0, 4));
    if (mismo) return `${cuenta(medio, sing)} ${plur ? pluralNombre(nombre) : nombre}`;
  }
  return `${cuenta(medio, sing)} ${noun} de ${nombre}`;
}
/** Ración casera con cifra: «2 cafés con leche», «½ plato de lentejas», «1 yogur». Sin ración conocida: «2 raciones». */
export function racionLabel(f: Food | undefined, n: number): string {
  const num = n === 0.5 ? "½" : Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10).replace(".", ",");
  const r = f?.rac[0];
  if (!f || !r) return `${num} ${n > 1 ? "raciones" : "ración"}`;
  const t = textoRacion(f, r, Math.abs(n - 1) < 0.01 ? 1 : n > 1 ? Math.max(n, 2) : n);
  return `${num} ${t.split(" ").slice(1).join(" ")}`;
}
const SOLIDOS = new Set(["pan", "bolleria", "galletas", "queso", "embutido", "carne", "pescado", "dulce", "snack", "fruta", "patata"]);

/** «una lata de atún al natural», «dos huevos», «media rebanada de pan» o «un trocito de pan».
 *  Elige, entre las raciones de casa del alimento, la que da un número más redondo. */
export function cantidadTexto(f: Food, grams: number): string {
  const nombre = nombreCorto(f);
  if (!f.rac.length || grams < 1) return `un poco de ${nombre}`;
  const BONITOS = [0.5, 1, 1.5, 2, 3, 4];
  let mejor: { r: Racion; v: number; err: number } | null = null;
  f.rac.forEach((r, i) => {
    const n = grams / r.g;
    for (const v of BONITOS) {
      const err = Math.abs(n - v) / v + i * 0.02; // ligera preferencia por la ración principal
      if (!mejor || err < mejor.err) mejor = { r, v, err };
    }
  });
  const m = mejor as { r: Racion; v: number; err: number } | null;
  if (m && m.err <= 0.22) return textoRacion(f, m.r, m.v);
  const menor = Math.min(...f.rac.map((r) => r.g));
  if (grams < menor * 0.45) return `${SOLIDOS.has(f.cat) ? "un trocito" : "un poco"} de ${nombre}`;
  // número poco redondo: la ración principal redondeada a medias
  const r0 = f.rac[0];
  const medio = Math.max(0.5, Math.round((grams / r0.g) * 2) / 2);
  return textoRacion(f, r0, medio);
}

/** Texto corto de la ración habitual: «1 lata (52 g)». */
export function racionTexto(f: Food): string {
  const r = f.rac[0];
  return r ? `${r.n} (${Math.round(r.g)} g)` : "100 g";
}
