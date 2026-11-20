// Widgets de iPhone (expo-widgets): Cobros, Te deben, Hoy, Atajos y Monotributo, en claro y oscuro.
// Ojo: expo-widgets convierte cada función en texto y la corre en el widget, así que todo lo que usa tiene que estar
// adentro (nada de constantes de otros archivos; solo componentes y modificadores). Sin emojis: símbolos del sistema.
import { HStack, Image, Link, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { background, containerBackground, cornerRadius, font, foregroundStyle, frame, lineLimit, padding, tint, widgetURL } from '@expo/ui/swift-ui/modifiers';
import type { WidgetEnvironment } from 'expo-widgets';
import type { Deudor, Mono, Turno } from './datos';

export type PropsCobros = { hay?: boolean; mes?: string; actualizado?: string; cobrado?: string; esperado?: string; deben?: string; pct?: number; usd?: string | null };
export type PropsDeben = { hay?: boolean; total?: string; cantidad?: number; variosMeses?: number; lista?: Deudor[] };
export type PropsHoy = { hay?: boolean; dia?: string; total?: number; faltan?: number; turnos?: Turno[] };
export type PropsAtajos = { hay?: boolean };
export type PropsMono = { hay?: boolean; mono?: Mono | null };

export function CobrosIOS(props: PropsCobros, env: WidgetEnvironment) {
  'widget';
  const o = env.colorScheme === 'dark';
  const c = o ? { fondo: '#1b201d', fondo2: '#252b27', texto: '#eceeea', suave: '#a0aaa4', acento: '#8bb89f', sobre: '#14201a', rojo: '#e8977b' } : { fondo: '#ffffff', fondo2: '#eeede7', texto: '#1e2420', suave: '#5d6660', acento: '#557f69', sobre: '#ffffff', rojo: '#a3452c' };
  const chico = env.widgetFamily === 'systemSmall';
  const marco = [containerBackground(c.fondo, 'widget'), widgetURL('honorapp://inicio'), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })];
  if (!props || !props.hay) {
    return (
      <VStack alignment="leading" spacing={6} modifiers={marco}>
        <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(c.texto)]}>Cobros</Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(c.suave), lineLimit(3)]}>Abrí honorapp para ver tus cobros acá.</Text>
      </VStack>
    );
  }
  return (
    <VStack alignment="leading" spacing={4} modifiers={marco}>
      <HStack>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(c.texto)]}>Cobros</Text>
        <Spacer />
        <Text modifiers={[font({ size: 12 }), foregroundStyle(c.suave)]}>{chico ? (props.mes || '').slice(0, 3) : props.mes || ''}</Text>
      </HStack>
      <Text modifiers={[font({ size: chico ? 28 : 34, design: 'serif' }), foregroundStyle(c.texto), lineLimit(1)]}>{props.cobrado || ''}</Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(c.suave), lineLimit(1)]}>{`${chico ? 'de' : 'cobrado de'} ${props.esperado || ''}`}</Text>
      <ProgressView value={Math.min(1, (props.pct || 0) / 100)} modifiers={[tint(c.acento)]} />
      <HStack>
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(c.rojo), lineLimit(1)]}>{`Te deben ${props.deben || ''}`}</Text>
        <Spacer />
        {!chico && props.usd ? <Text modifiers={[font({ size: 12 }), foregroundStyle(c.suave)]}>{`${props.usd} cobrado`}</Text> : null}
      </HStack>
      {chico ? null : <Spacer />}
      {chico ? null : (
        <HStack>
          <Text modifiers={[font({ size: 11 }), foregroundStyle(c.suave)]}>{`Act. ${props.actualizado || ''}`}</Text>
          <Spacer />
          <Link destination="honorapp://pago">
            <HStack spacing={4} modifiers={[padding({ horizontal: 12, vertical: 6 }), background(c.acento), cornerRadius(14)]}>
              <Image systemName="plus" size={13} color={c.sobre} />
              <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(c.sobre)]}>Pago</Text>
            </HStack>
          </Link>
        </HStack>
      )}
    </VStack>
  );
}

export function DebenIOS(props: PropsDeben, env: WidgetEnvironment) {
  'widget';
  const o = env.colorScheme === 'dark';
  const c = o ? { fondo: '#1b201d', texto: '#eceeea', suave: '#a0aaa4', acento: '#8bb89f', fuerte: '#a8ccb8', blando: '#223129', sobre: '#14201a', rojo: '#e8977b' } : { fondo: '#ffffff', texto: '#1e2420', suave: '#5d6660', acento: '#557f69', fuerte: '#3c6450', blando: '#e2ece5', sobre: '#ffffff', rojo: '#a3452c' };
  const grande = env.widgetFamily === 'systemLarge' || env.widgetFamily === 'systemExtraLarge';
  const lista = ((props && props.lista) || []).slice(0, grande ? 5 : 3);
  const cantidad = (props && props.cantidad) || 0;
  return (
    <VStack alignment="leading" spacing={grande ? 8 : 5} modifiers={[containerBackground(c.fondo, 'widget'), widgetURL('honorapp://deben'), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
      <HStack>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(c.texto)]}>Te deben</Text>
        <Spacer />
        <Text modifiers={[font({ size: 12 }), foregroundStyle(c.suave)]}>{cantidad ? (props.total || '') : ''}</Text>
      </HStack>
      {props && props.hay ? null : <Text modifiers={[font({ size: 13 }), foregroundStyle(c.suave), lineLimit(2)]}>Abrí honorapp para ver quién te debe.</Text>}
      {props && props.hay && !lista.length ? <Text modifiers={[font({ size: 13 }), foregroundStyle(c.suave), lineLimit(3)]}>{cantidad ? `${cantidad} ${cantidad === 1 ? 'paciente te debe' : 'pacientes te deben'}. Tocá para ver.` : 'Nadie te debe. Todo al día.'}</Text> : null}
      {lista.map((x, i) => (
        <HStack key={i} spacing={10}>
          <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle(c.fuerte), frame({ width: 30, height: 30 }), background(c.blando), cornerRadius(10)]}>
            {x.nombre.split(' ').filter((s) => s.length > 0).map((s) => s[0]).join('').slice(0, 2)}
          </Text>
          <VStack alignment="leading" spacing={0}>
            <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(c.texto), lineLimit(1)]}>{x.nombre}</Text>
            <Text modifiers={[font({ size: 11 }), foregroundStyle(x.variosMeses ? c.rojo : c.suave), lineLimit(1)]}>{x.meses}</Text>
          </VStack>
          <Spacer />
          <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(c.texto)]}>{x.monto}</Text>
        </HStack>
      ))}
      <Spacer />
      {grande && cantidad ? (
        <HStack>
          <Text modifiers={[font({ size: 11 }), foregroundStyle(c.suave), lineLimit(1)]}>{`${cantidad} ${cantidad === 1 ? 'paciente' : 'pacientes'}`}</Text>
          <Spacer />
          <Link destination="honorapp://deben">
            <HStack spacing={4} modifiers={[padding({ horizontal: 12, vertical: 6 }), background(c.acento), cornerRadius(14)]}>
              <Image systemName="bell" size={13} color={c.sobre} />
              <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(c.sobre)]}>Recordar</Text>
            </HStack>
          </Link>
        </HStack>
      ) : null}
    </VStack>
  );
}

export function HoyIOS(props: PropsHoy, env: WidgetEnvironment) {
  'widget';
  const o = env.colorScheme === 'dark';
  const c = o ? { fondo: '#1b201d', texto: '#eceeea', suave: '#a0aaa4', acento: '#8bb89f', fuerte: '#a8ccb8', sobre: '#14201a' } : { fondo: '#ffffff', texto: '#1e2420', suave: '#5d6660', acento: '#557f69', fuerte: '#3c6450', sobre: '#ffffff' };
  const grande = env.widgetFamily === 'systemLarge' || env.widgetFamily === 'systemExtraLarge';
  const turnos = ((props && props.turnos) || []).slice(0, grande ? 6 : 3);
  const total = (props && props.total) || 0;
  return (
    <VStack alignment="leading" spacing={grande ? 9 : 5} modifiers={[containerBackground(c.fondo, 'widget'), widgetURL('honorapp://agenda'), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
      <HStack>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(c.texto)]}>Hoy</Text>
        <Spacer />
        <Text modifiers={[font({ size: 12 }), foregroundStyle(c.suave)]}>{(props && props.dia) || ''}</Text>
      </HStack>
      {props && props.hay ? null : <Text modifiers={[font({ size: 13 }), foregroundStyle(c.suave), lineLimit(2)]}>Abrí honorapp para ver tu agenda.</Text>}
      {props && props.hay && !turnos.length ? <Text modifiers={[font({ size: 13 }), foregroundStyle(c.suave)]}>Hoy no tenés sesiones.</Text> : null}
      {turnos.map((t, i) => (
        <HStack key={i} spacing={10}>
          <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(t.proxima ? c.fuerte : c.suave)]}>{t.hora}</Text>
          <VStack alignment="leading" spacing={0}>
            <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(t.hecho ? c.suave : c.texto), lineLimit(1)]}>{t.nombre}</Text>
            {t.proxima && t.enMin ? <Text modifiers={[font({ size: 11 }), foregroundStyle(c.fuerte)]}>{t.enMin < 60 ? `en ${t.enMin} min` : 'la próxima'}</Text> : null}
          </VStack>
          <Spacer />
          {t.hecho ? <Image systemName="checkmark.circle" size={16} color={c.acento} /> : null}
        </HStack>
      ))}
      <Spacer />
      <HStack>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(c.suave)]}>{total ? `${total} ${total === 1 ? 'sesión' : 'sesiones'} · faltan ${(props && props.faltan) || 0}` : ''}</Text>
        <Spacer />
        {grande ? (
          <Link destination="honorapp://sesion">
            <HStack spacing={4} modifiers={[padding({ horizontal: 12, vertical: 6 }), background(c.acento), cornerRadius(14)]}>
              <Image systemName="plus" size={13} color={c.sobre} />
              <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(c.sobre)]}>Sesión</Text>
            </HStack>
          </Link>
        ) : null}
      </HStack>
    </VStack>
  );
}

export function AtajosIOS(_props: PropsAtajos, env: WidgetEnvironment) {
  'widget';
  const o = env.colorScheme === 'dark';
  const c = o ? { fondo: '#1b201d', fondo2: '#252b27', texto: '#eceeea', acento: '#8bb89f', sobre: '#14201a' } : { fondo: '#ffffff', fondo2: '#eeede7', texto: '#1e2420', acento: '#557f69', sobre: '#ffffff' };
  const chico = env.widgetFamily === 'systemSmall';
  const boton = (url: string, simbolo: string, texto: string, ppal: boolean) => (
    <Link key={url} destination={url}>
      <HStack spacing={6} modifiers={[padding({ horizontal: 8, vertical: chico ? 8 : 14 }), frame({ maxWidth: 10000 }), background(ppal ? c.acento : c.fondo2), cornerRadius(14)]}>
        <Image systemName={simbolo as never} size={15} color={ppal ? c.sobre : c.texto} />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(ppal ? c.sobre : c.texto), lineLimit(1)]}>{texto}</Text>
      </HStack>
    </Link>
  );
  const botones = [
    boton('honorapp://sesion', 'calendar.badge.clock', 'Sesión', true),
    boton('honorapp://pago', 'banknote', 'Pago', false),
    boton('honorapp://comprobante', 'doc.on.clipboard', 'Pegar', false),
  ];
  return chico ? (
    <VStack spacing={6} modifiers={[containerBackground(c.fondo, 'widget')]}>{botones}</VStack>
  ) : (
    <HStack spacing={8} modifiers={[containerBackground(c.fondo, 'widget')]}>{botones}</HStack>
  );
}

export function MonoIOS(props: PropsMono, env: WidgetEnvironment) {
  'widget';
  const o = env.colorScheme === 'dark';
  const c = o ? { fondo: '#1b201d', texto: '#eceeea', suave: '#a0aaa4', acento: '#8bb89f', ambar: '#e3b66c', rojo: '#e8977b' } : { fondo: '#ffffff', texto: '#1e2420', suave: '#5d6660', acento: '#557f69', ambar: '#8f6418', rojo: '#a3452c' };
  const chico = env.widgetFamily === 'systemSmall';
  const m = props && props.mono;
  const marco = [containerBackground(c.fondo, 'widget'), widgetURL('honorapp://inicio'), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })];
  if (!m) {
    return (
      <VStack alignment="leading" spacing={6} modifiers={marco}>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(c.texto)]}>Monotributo</Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(c.suave), lineLimit(4)]}>{props && props.hay ? 'Elegí tu categoría en Ajustes para ver cuánto te falta para el tope.' : 'Abrí honorapp para ver tu monotributo.'}</Text>
      </VStack>
    );
  }
  const color = m.estado === 'bien' ? c.acento : m.estado === 'cerca' ? c.ambar : c.rojo;
  const texto = m.estado === 'bien' ? 'vas bien' : m.estado === 'cerca' ? 'cerca del tope' : 'pasaste el tope';
  return (
    <VStack alignment="leading" spacing={4} modifiers={marco}>
      <HStack>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(c.texto)]}>Monotributo</Text>
        <Spacer />
        <Text modifiers={[font({ size: 12 }), foregroundStyle(c.suave)]}>{chico ? `Cat. ${m.categoria}` : `Categoría ${m.categoria}`}</Text>
      </HStack>
      <Text modifiers={[font({ size: chico ? 28 : 32, design: 'serif' }), foregroundStyle(c.texto), lineLimit(1)]}>{m.cobrado}</Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(c.suave), lineLimit(2)]}>{`${chico ? 'en 12 meses, de' : 'cobrado en 12 meses, de'} ${m.tope}`}</Text>
      <ProgressView value={Math.min(1, m.pct / 100)} modifiers={[tint(color)]} />
      <HStack>
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(color)]}>{`${m.pct}% · ${texto}`}</Text>
        <Spacer />
        {chico ? null : <Text modifiers={[font({ size: 11 }), foregroundStyle(c.suave)]}>{`recategorización en ${m.recat}`}</Text>}
      </HStack>
    </VStack>
  );
}
