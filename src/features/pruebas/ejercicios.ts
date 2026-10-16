import type { Palabras } from '../../lib/terminos'

/** Un ejercicio de la prueba con usuarias: una tarea real dentro de la app. */
export interface Ejercicio {
  id: string
  titulo: string
  /** Qué tiene que hacer la persona, en una o dos frases. */
  instruccion: string
  /** Cómo se da cuenta de que lo logró. */
  logrado: string
  /** Pantalla desde la que arranca, para que todas empiecen igual. */
  inicio: string
  /** Tiempo razonable en segundos: sirve para ver qué ejercicio costó más de lo esperado. */
  esperado: number
}

/** Los ejercicios, en el orden en que se hacen. Usan el vocabulario de la profesión (sesión o consulta). */
export function armarEjercicios(pal: Palabras): Ejercicio[] {
  return [
    {
      id: 'paciente-estandar',
      titulo: 'Cargar un paciente',
      instruccion: 'Cargá un paciente nuevo que se llame «Lucía Pérez», con tu propio teléfono y la tarifa estándar.',
      logrado: 'Lucía aparece en la lista de Pacientes.',
      inicio: '/',
      esperado: 90,
    },
    {
      id: 'paciente-personalizado',
      titulo: 'Paciente con otra tarifa',
      instruccion: `Cargá a «Martín Gómez», sin teléfono y con una tarifa personalizada de $ 30.000 ${pal.porUnidad}.`,
      logrado: 'Martín aparece en Pacientes con $ 30.000 y la palabra «personalizada».',
      inicio: '/pacientes',
      esperado: 90,
    },
    {
      id: 'sesion-hoy',
      titulo: `Registrar una ${pal.sesion}`,
      instruccion: `Registrá una ${pal.sesion} de Lucía de hoy.`,
      logrado: `En la ficha de Lucía figura la ${pal.sesion} de hoy.`,
      inicio: '/',
      esperado: 45,
    },
    {
      id: 'sesion-calendario',
      titulo: 'Elegir el día en el calendario',
      instruccion: `Registrá otra ${pal.sesion} de Lucía, del martes pasado, eligiendo el día en el calendario.`,
      logrado: `En la ficha de Lucía figura la ${pal.sesion} del martes pasado.`,
      inicio: '/',
      esperado: 60,
    },
    {
      id: 'pago-parcial',
      titulo: 'Registrar un pago',
      instruccion: 'Registrá que Lucía te pagó $ 10.000 por transferencia.',
      logrado: 'En la ficha de Lucía aparece el pago y baja lo que debe.',
      inicio: '/',
      esperado: 60,
    },
    {
      id: 'cuanto-debe',
      titulo: 'Ver cuánto te deben',
      instruccion: 'Fijate cuánto te debe Lucía en total. Cuando lo encuentres, anotá el monto en el comentario.',
      logrado: 'Encontraste el monto que debe Lucía.',
      inicio: '/',
      esperado: 40,
    },
    {
      id: 'recordatorio',
      titulo: 'Recordatorio por WhatsApp',
      instruccion: 'Abrí el recordatorio de pago por WhatsApp para Lucía. Va a tu propio número: no hace falta enviarlo.',
      logrado: 'Se abrió WhatsApp con el mensaje escrito.',
      inicio: '/',
      esperado: 45,
    },
    {
      id: 'generar-mes',
      titulo: `Generar las ${pal.sesiones} del mes`,
      instruccion: `A Martín lo atendés todos los lunes una hora. Generá todas sus ${pal.sesiones} de este mes de una sola vez.`,
      logrado: `En la ficha de Martín aparecen las ${pal.sesiones} de todos los lunes del mes.`,
      inicio: '/pacientes',
      esperado: 120,
    },
    {
      id: 'mes-anterior',
      titulo: 'Mirar otro mes',
      instruccion: 'En Inicio, mirá cuánto cobraste el mes pasado, eligiéndolo en el calendario de meses.',
      logrado: 'Inicio muestra el mes pasado.',
      inicio: '/',
      esperado: 40,
    },
    {
      id: 'reporte-pdf',
      titulo: 'Reporte para la contadora',
      instruccion: 'Descargá el reporte de este mes para tu contadora, en PDF.',
      logrado: 'Se descargó un PDF y lo pudiste abrir.',
      inicio: '/',
      esperado: 60,
    },
    {
      id: 'excel',
      titulo: 'Descargar tus datos',
      instruccion: 'Descargá todos tus datos en un Excel.',
      logrado: 'Se descargó un archivo de Excel y lo pudiste abrir.',
      inicio: '/',
      esperado: 45,
    },
    {
      id: 'letra',
      titulo: 'Tamaño de letra',
      instruccion: 'Cambiá el tamaño de letra al que te resulte más cómodo para leer.',
      logrado: 'Toda la app se ve con la letra que elegiste.',
      inicio: '/',
      esperado: 30,
    },
    {
      id: 'borrar',
      titulo: 'Borrar un paciente',
      instruccion: 'Borrá a Martín Gómez con todo su historial.',
      logrado: 'Martín ya no aparece en Pacientes.',
      inicio: '/',
      esperado: 45,
    },
  ]
}

/** Agrupa rutas parecidas: todas las fichas de paciente cuentan como una pantalla. */
export function nombrePantalla(ruta: string): string {
  if (/^\/pacientes\/[^/]+/.test(ruta)) return 'Ficha de paciente'
  const nombres: Record<string, string> = {
    '/': 'Inicio',
    '/pacientes': 'Pacientes',
    '/mes': 'Mes',
    '/contadora': 'Contadora',
    '/importar': 'Importar',
    '/ajustes': 'Ajustes',
    '/pruebas': 'Pruebas',
  }
  return nombres[ruta] ?? ruta
}

/** Preguntas de la encuesta final. */
export const ENCUESTA = {
  hoy: {
    pregunta: '¿Cómo llevás hoy los cobros de tus pacientes?',
    opciones: ['Cuaderno o agenda', 'Excel o planilla', 'Otra app', 'De memoria', 'Otra forma'],
  },
  sirvio: {
    pregunta: '¿Qué te sirvió más? Elegí hasta 3.',
    opciones: [
      'Ver de un vistazo quién me debe',
      'Registrar sesiones y pagos',
      'Pesos y dólares por separado',
      'Recordatorios por WhatsApp',
      'El reporte para mi contadora',
      'Descargar o importar Excel',
      'El tamaño de letra',
    ],
    maximo: 3,
  },
  costo: {
    pregunta: '¿Hubo algo que te costó entender?',
    opciones: [
      'Cargar un paciente',
      'Registrar una sesión o un pago',
      'Entender cuánto me deben',
      'El recordatorio por WhatsApp',
      'Los reportes y descargas',
      'El calendario',
      'Nada, fue todo claro',
    ],
  },
  falto: {
    pregunta: '¿Qué te faltó? Elegí todo lo que te serviría.',
    opciones: [
      'Factura electrónica desde la app (ARCA)',
      'Que los recordatorios salgan solos',
      'Agenda de turnos',
      'Link de pago de Mercado Pago',
      'Aviso del tope del monotributo',
      'Recibo para el paciente',
      'Nada, así está bien',
    ],
  },
  recomendaria: {
    pregunta: 'Del 0 al 10, ¿qué tan probable es que se la recomiendes a una colega?',
  },
  pagaria: {
    pregunta: 'Si tuviera una versión paga con más funciones, ¿pagarías?',
    opciones: [
      'Sí, aunque tuviera solo lo de hoy',
      'Sí, si suma lo que me faltó',
      'Tal vez, según el precio',
      'No, solo la usaría gratis',
    ],
  },
  precio: {
    pregunta: '¿Cuánto te parecería razonable por mes?',
    opciones: ['Hasta $ 3.000', '$ 3.000 a $ 6.000', '$ 6.000 a $ 10.000', 'Más de $ 10.000'],
  },
  comentario: {
    pregunta: '¿Algo más que quieras contarnos?',
  },
} as const

export type ClaveEncuesta = keyof typeof ENCUESTA
