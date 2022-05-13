import type { AcornNode as AcornNode2 } from 'rollup'

export type AcornNode<T = any> = AcornNode2 & Record<string, T>
