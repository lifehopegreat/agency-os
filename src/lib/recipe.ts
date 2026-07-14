import type { AssetRecipe, LibraryAsset } from '../state/GenerationContext';
import { formRatioFromAsset } from '../data/models';

/** Build a reuse recipe from any library asset (handles legacy records). */
export function recipeFromAsset(asset: LibraryAsset): AssetRecipe {
  if (asset.recipe?.prompt) {
    return {
      ...asset.recipe,
      ratio: asset.recipe.ratio.replace('/', ':'),
      prompt: asset.recipe.prompt || asset.prompt,
      type: asset.recipe.type || asset.type,
      model: asset.recipe.model || asset.model,
    };
  }
  return {
    prompt: asset.prompt,
    type: asset.type,
    model: asset.model,
    ratio: formRatioFromAsset(asset.ratio),
  };
}

export type CreateLocationState = {
  reuse?: AssetRecipe;
  reuseFrom?: string;
  references?: Array<{
    name: string;
    url: string;
    kind?: 'image' | 'video';
  }>;
  /** Compatibility with the initial single-reference handoff. */
  reference?: {
    name: string;
    url: string;
  };
};
