import { ExecEnv, IBlock, IBlockNode, NodeType } from '../common';
import { Argument, Mixin, MixinParams, Ruleset, Selector } from '../model';
import { MixinMatcher } from './mixin';

export interface RulesetMatch {
  kind: 'ruleset';
  selector: Selector;
  ruleset: Ruleset;
}

export interface MixinMatch {
  kind: 'mixin';
  mixin: Mixin;
  params: MixinParams;
}

export type MixinResolverMatch = RulesetMatch | MixinMatch;

export type MixinClosureArrow = (mixin: Mixin) => ExecEnv | undefined;

export class MixinResolver {

  readonly matches: MixinResolverMatch[] = [];
  readonly args: Argument[];
  readonly callPath: string[];
  readonly callPathSize: number;
  readonly endIndex: number;

  constructor(readonly matcher: MixinMatcher, readonly closureArrow: MixinClosureArrow) {
    this.args = matcher.args.args;
    this.callPath = matcher.call.mixinPath || [];
    this.callPathSize = this.callPath.length;
    this.endIndex = this.callPathSize - 1;
  }

  resolve(frames: IBlockNode[]): boolean {
    const prefix = this.callPath[0];
    const start = frames.length - 1;
    for (let i = start; i >= 0; i--) {

      // Prune the mixin search space at the top level. If no paths
      // have our desired prefix we skip the block entirely.

      const { block } = frames[i];
      if (block.mixins && block.mixins.has(prefix)) {
        if (this.match(0, block)) {
          return true;
        }
      }
    }
    return false;
  }

  match(index: number, block: IBlock): boolean {
    if (index >= this.callPathSize || !block.mixins) {
      return false;
    }

    // We prune the mixin search space at every level, leveraging
    // the mixin path prefix index to avoid scanning non-matching blocks.
    // We also iterate directly over only mixin nodes.

    const segment = this.callPath[index];
    const mixins = block.mixins.get(segment);
    if (!mixins) {
      return false;
    }

    let matched = false;
    for (const rule of mixins) {
      if (rule.type === NodeType.RULESET) {
        const ruleset = rule as Ruleset;
        // Do some quick checks to avoid scanning into rulesets that
        // will yield no matches.
        if (!ruleset.hasMixinPath) {
          continue;
        }
        // Avoid recursing into rulesets that are currently being evaluated
        // otherwise we hit infinite recursion.
        const original = ruleset.original as Ruleset;
        if (original.evaluating) {
          continue;
        }
        // Scan this ruleset for matches.
        if (this.matchRuleset(index, rule as Ruleset)) {
          matched = true;
        }
      } else if (rule.type === NodeType.MIXIN) {
        if (this.matchMixin(index, rule as Mixin)) {
          matched = true;
        }
      }
    }
    return matched;
  }

  protected matchRuleset(index: number, ruleset: Ruleset): boolean {
    const { selectors } = ruleset.selectors;
    for (const selector of selectors) {
      const path = selector.mixinPath;
      if (!path) {
        continue;
      }

      const remaining = this.matchPath(index, path);
      if (remaining < 0) {
        continue;
      }

      if (remaining === 0) {
        // Full match, if no args present, add this to results.
        if (this.args.length === 0) {
          this.matches.push({ kind: 'ruleset', ruleset, selector });
          return true;
        }
      } else {
        // Partial match, continue matching the children of this ruleset.
        if (this.match(index + path.length, ruleset.block)) {
          return true;
        }
      }
    }
    return false;
  }

  protected matchMixin(index: number, mixin: Mixin): boolean {
    const matched = this.callPath[index] === mixin.name;
    if (!matched) {
      return false;
    }
    if (index < this.endIndex) {
      // We haven't matched the entire path, so drill deeper.
      return this.match(index + 1, mixin.block);
    }

    const env = this.matcher.env.copy();

    const defEnv = this.closureArrow(mixin);
    if (defEnv !== undefined) {
      env.append(defEnv.frames);
    }

    const params = mixin.params.eval(env) as MixinParams;
    const matches = this.matcher.patternMatch(params);
    if (matches) {
      this.matches.push({ kind: 'mixin', mixin, params });
    }
    return matches;
  }

  protected matchPath(index: number, other: string[]): number {
    const otherSize = other.length;
    const currSize = this.callPathSize - index;
    if (otherSize === 0 || currSize < otherSize) {
      return -1;
    }
    let j = 0;
    while (j < otherSize) {
      if (this.callPath[index] !== other[j]) {
        return -1;
      }
      index++;
      j++;
    }
    return this.callPathSize - index;
  }
}
