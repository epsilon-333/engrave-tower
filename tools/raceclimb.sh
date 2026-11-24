#!/bin/sh
# 종족마다 등반 시뮬레이션 (권장 레벨 · 60층까지): sh tools/raceclimb.sh [등반 수=3] [RACE_BAL_PVE 시험값 … (dino wizard knight orc undead assassin elf dragon 순서)]
cd "$(dirname "$0")/.."
n="${1:-3}"; [ $# -gt 0 ] && shift
for r in dino wizard knight orc undead assassin elf dragon; do
  if [ -n "$1" ]; then b="$1"; shift; else b=""; fi
  ( if [ -n "$b" ]; then export RBAL="$b"; fi; QUIET=1 node tools/tests/climbsim.mjs "$r" auto "$n" 60 1 | tail -1 ) &
done
wait
