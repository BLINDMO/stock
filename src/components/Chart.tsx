import { useEffect, useMemo, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import { ALL_INDICATORS, useStore, type IndicatorKey } from '../state/store';
import { sim } from '../state/sim';
import { useSimTick } from '../hooks/useSim';
import { ASSET_MAP } from '../engine/assets';
import type { Timeframe } from '../engine/market';
import { bollinger, ema, macd, rsi, sma, vwap } from '../engine/indicators';
import { price as fmtPrice, pct, compact } from '../util/format';

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1D', '1W'];

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function Chart() {
  const symbol = useStore((s) => s.symbol);
  const timeframe = useStore((s) => s.timeframe);
  const indicators = useStore((s) => s.indicators);
  const theme = useStore((s) => s.settings.theme);
  const setTimeframe = useStore((s) => s.setTimeframe);
  const toggleIndicator = useStore((s) => s.toggleIndicator);

  const hostRef = useRef<HTMLDivElement>(null);
  const oscRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const oscChartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Record<string, ISeriesApi<any>>>({});
  const lastKeyRef = useRef('');

  const showOsc = indicators.includes('RSI') || indicators.includes('MACD');

  // (Re)build the chart when theme or oscillator presence changes.
  useEffect(() => {
    if (!hostRef.current) return;
    const up = cssVar('--up');
    const down = cssVar('--down');
    const text = cssVar('--text-dim');
    const grid = cssVar('--border');
    const bg = cssVar('--bg');

    const chart = createChart(hostRef.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: bg }, textColor: text, fontFamily: 'Inter, sans-serif' },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: grid },
      timeScale: { borderColor: grid, timeVisible: true, secondsVisible: false, rightOffset: 6 },
    });
    chartRef.current = chart;

    const candle = chart.addCandlestickSeries({
      upColor: up,
      downColor: down,
      borderVisible: false,
      wickUpColor: up,
      wickDownColor: down,
    });
    const volume = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    seriesRef.current = { candle, volume };
    seriesRef.current.ma20 = chart.addLineSeries({ color: '#f5a623', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    seriesRef.current.ma50 = chart.addLineSeries({ color: '#bd6cff', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    seriesRef.current.ema9 = chart.addLineSeries({ color: '#2dd4bf', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    seriesRef.current.vwap = chart.addLineSeries({ color: '#e879f9', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
    seriesRef.current.bbu = chart.addLineSeries({ color: cssVar('--accent'), lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    seriesRef.current.bbl = chart.addLineSeries({ color: cssVar('--accent'), lineWidth: 1, priceLineVisible: false, lastValueVisible: false });

    let oscChart: IChartApi | null = null;
    if (showOsc && oscRef.current) {
      oscChart = createChart(oscRef.current, {
        autoSize: true,
        layout: { background: { type: ColorType.Solid, color: bg }, textColor: text, fontFamily: 'Inter, sans-serif' },
        grid: { vertLines: { color: grid }, horzLines: { color: grid } },
        rightPriceScale: { borderColor: grid },
        timeScale: { borderColor: grid, timeVisible: true, secondsVisible: false, visible: true },
      });
      oscChartRef.current = oscChart;
      const bothOsc = indicators.includes('RSI') && indicators.includes('MACD');
      if (bothOsc) oscChart.applyOptions({ leftPriceScale: { visible: true, borderColor: grid } });
      if (indicators.includes('RSI')) {
        const r = oscChart.addLineSeries({
          color: '#f5a623',
          lineWidth: 2,
          priceLineVisible: false,
          priceScaleId: bothOsc ? 'left' : 'right',
        });
        r.createPriceLine({ price: 70, color: down, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: '' });
        r.createPriceLine({ price: 30, color: up, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: '' });
        seriesRef.current.rsi = r;
      }
      if (indicators.includes('MACD')) {
        seriesRef.current.macdHist = oscChart.addHistogramSeries({ priceLineVisible: false });
        seriesRef.current.macdLine = oscChart.addLineSeries({ color: cssVar('--accent'), lineWidth: 1, priceLineVisible: false });
        seriesRef.current.macdSignal = oscChart.addLineSeries({ color: '#f5a623', lineWidth: 1, priceLineVisible: false });
      }
      // Keep the oscillator pane's time axis aligned with the price chart.
      const main = chart.timeScale();
      const sub = oscChart.timeScale();
      let syncing = false;
      main.subscribeVisibleLogicalRangeChange((r) => {
        if (syncing || !r) return;
        syncing = true;
        sub.setVisibleLogicalRange(r);
        syncing = false;
      });
      sub.subscribeVisibleLogicalRangeChange((r) => {
        if (syncing || !r) return;
        syncing = true;
        main.setVisibleLogicalRange(r);
        syncing = false;
      });
    }

    lastKeyRef.current = '';
    drawAll();
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      oscChart?.remove();
      chartRef.current = null;
      oscChartRef.current = null;
      seriesRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, showOsc, indicators.includes('RSI'), indicators.includes('MACD')]);

  // Redraw fully when symbol / timeframe / indicator set changes.
  useEffect(() => {
    lastKeyRef.current = '';
    drawAll();
    chartRef.current?.timeScale().fitContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe, indicators.join(',')]);

  // Live updates without React re-render.
  useEffect(() => {
    let acc = 0;
    let last = performance.now();
    const unsub = sim.subscribe(() => {
      const now = performance.now();
      acc += now - last;
      last = now;
      if (acc < 180) {
        liveUpdate();
        return;
      }
      acc = 0;
      drawAll();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe, indicators.join(',')]);

  function liveUpdate() {
    const eng = sim.engine;
    const s = seriesRef.current;
    if (!eng || !s.candle) return;
    const bars = eng.getBars(symbol, timeframe);
    if (bars.length === 0) return;
    const b = bars[bars.length - 1];
    s.candle.update({ time: b.time as Time, open: b.open, high: b.high, low: b.low, close: b.close });
    const up = cssVar('--up');
    const down = cssVar('--down');
    s.volume?.update({ time: b.time as Time, value: b.volume, color: b.close >= b.open ? up + '55' : down + '55' });
  }

  function drawAll() {
    const eng = sim.engine;
    const s = seriesRef.current;
    if (!eng || !s.candle) return;
    const bars = eng.getBars(symbol, timeframe);
    if (bars.length === 0) return;
    const key = symbol + timeframe + bars.length;
    const up = cssVar('--up');
    const down = cssVar('--down');

    s.candle.setData(bars.map((b) => ({ time: b.time as Time, open: b.open, high: b.high, low: b.low, close: b.close })));
    s.volume?.setData(
      bars.map((b) => ({ time: b.time as Time, value: b.volume, color: (b.close >= b.open ? up : down) + '55' })),
    );

    const on = (k: IndicatorKey) => indicators.includes(k);
    setLine(s.ma20, on('MA20') ? sma(bars, 20) : []);
    setLine(s.ma50, on('MA50') ? sma(bars, 50) : []);
    setLine(s.ema9, on('EMA9') ? ema(bars, 9) : []);
    setLine(s.vwap, on('VWAP') ? vwap(bars) : []);
    if (on('BOLL')) {
      const bb = bollinger(bars, 20, 2);
      setLine(s.bbu, bb.upper);
      setLine(s.bbl, bb.lower);
    } else {
      setLine(s.bbu, []);
      setLine(s.bbl, []);
    }
    s.volume?.applyOptions({ visible: on('VOL') });

    const perYear = ASSET_MAP[symbol]?.class === 'crypto' ? 365 * 1440 : 252 * 390;
    void perYear;
    if (s.rsi) setLine(s.rsi, rsi(bars, 14));
    if (s.macdLine) {
      const m = macd(bars);
      setLine(s.macdLine, m.macd);
      setLine(s.macdSignal, m.signal);
      s.macdHist?.setData(
        m.hist.map((p) => ({ time: p.time as Time, value: p.value, color: (p.value >= 0 ? up : down) + 'aa' })),
      );
    }
    lastKeyRef.current = key;
  }

  function setLine(series: ISeriesApi<any> | undefined, data: { time: number; value: number }[]) {
    if (!series) return;
    series.setData(data.map((p) => ({ time: p.time as Time, value: p.value })));
  }

  return (
    <>
      <ChartHeader symbol={symbol} />
      <div className="chart-toolbar">
        <div className="tf-group">
          {TIMEFRAMES.map((t) => (
            <button key={t} className={timeframe === t ? 'active' : ''} onClick={() => setTimeframe(t)}>
              {t}
            </button>
          ))}
        </div>
        <div className="ind-group">
          {ALL_INDICATORS.map((k) => (
            <button key={k} className={indicators.includes(k) ? 'active' : ''} onClick={() => toggleIndicator(k)}>
              {k}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-wrap">
        <div ref={hostRef} style={{ position: 'absolute', inset: 0, bottom: showOsc ? '32%' : 0 }} />
        {showOsc && <div ref={oscRef} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '32%' }} />}
      </div>
    </>
  );
}

function ChartHeader({ symbol }: { symbol: string }) {
  useSimTick(250);
  const def = ASSET_MAP[symbol];
  const st = sim.engine?.assets.get(symbol);
  const px = st?.price ?? def?.seedPrice ?? 0;
  const dayOpen = st?.dayOpen ?? px;
  const chg = px - dayOpen;
  const chgPct = dayOpen > 0 ? (chg / dayOpen) * 100 : 0;
  const bars = sim.engine?.assets.get(symbol)?.bars ?? [];
  const dayHigh = st?.dayAccum?.high ?? Math.max(...bars.slice(-60).map((b) => b.high), px);
  const dayLow = st?.dayAccum?.low ?? Math.min(...bars.slice(-60).map((b) => b.low), px);
  const mcap = def ? px * def.supply : 0;

  return (
    <div className="chart-head">
      <div>
        <span className="sym-big">{symbol}</span>{' '}
        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{def?.name}</span>
      </div>
      <div className="px-big mono">{fmtPrice(px)}</div>
      <div className={'chg-big mono ' + (chg >= 0 ? 'up' : 'down')}>
        {chg >= 0 ? '+' : ''}
        {fmtPrice(chg)} ({pct(chgPct)})
      </div>
      <div className="meta mono">
        <span>
          Day H <b>{fmtPrice(dayHigh)}</b>
        </span>
        <span>
          Day L <b>{fmtPrice(dayLow)}</b>
        </span>
        <span>
          {def?.class === 'crypto' ? 'Mkt Cap' : 'Mkt Cap'} <b>${compact(mcap)}</b>
        </span>
      </div>
    </div>
  );
}
