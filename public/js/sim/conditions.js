// 조건 엔진: 스탯 임계, 스탯 비교, 스탯 차이, 태그 수, 종족, 극한, 만능
import { STAT_INFO, SPECIAL_INFO, BASE_STATS } from '../data/stats.js';
import { TAGS } from '../data/engravings.js';
import { RACES } from '../data/races.js';

const statName = (k) => (STAT_INFO[k] || SPECIAL_INFO[k] || { name: k }).name;

export function evalCond(c, ctx) {
  if (!c) return true;
  if (c.all) return c.all.every((x) => evalCond(x, ctx));
  if (c.any) return c.any.some((x) => evalCond(x, ctx));
  if (c.stat) {
    const v = ctx.stats[c.stat] || 0;
    if (c.gte != null && v < c.gte) return false;
    if (c.lte != null && v > c.lte) return false;
    return true;
  }
  if (c.cmp) {
    const [a, op, b] = c.cmp;
    const va = ctx.stats[a] || 0, vb = ctx.stats[b] || 0;
    return op === '>' ? va > vb : op === '<' ? va < vb : va >= vb;
  }
  if (c.diff) return Math.abs((ctx.stats[c.diff[0]] || 0) - (ctx.stats[c.diff[1]] || 0)) <= c.lte;
  if (c.tag) return (ctx.tags[c.tag] || 0) >= c.gte;
  if (c.race) return ctx.race === c.race;
  if (c.extreme) return !!ctx.extreme;
  if (c.minBase != null) return Math.min(...BASE_STATS.map((k) => ctx.stats[k] || 0)) >= c.minBase;
  return false;
}

export function condText(c) {
  if (!c) return '';
  if (c.all) return c.all.map(condText).join(' 그리고 ');
  if (c.any) return c.any.map(condText).join(' 또는 ');
  if (c.stat) return `${statName(c.stat)} ${c.gte != null ? c.gte + ' 이상' : c.lte + ' 이하'}`;
  if (c.cmp) return `${statName(c.cmp[0])} ${c.cmp[1]} ${statName(c.cmp[2])}`;
  if (c.diff) return `${statName(c.diff[0])}·${statName(c.diff[1])} 차이 ${c.lte} 이하`;
  if (c.tag) return `[${TAGS[c.tag]?.name || c.tag}] ${c.gte}개 이상`;
  if (c.race) return `${RACES[c.race].name}일 때`;
  if (c.extreme) return '극한 상태일 때';
  if (c.minBase != null) return `모든 기본 스탯 ${c.minBase} 이상`;
  return '?';
}
