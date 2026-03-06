import { CRAFTING_RECIPES, CraftingRecipe } from './CraftingRecipes';
import { Inventory } from '../inventory/Inventory';
import { EventBus, Events } from '../world/EventBus';

export class CraftingSystem {
  getAvailableRecipes(
    inventory: Inventory,
    npcTrustMap: Record<string, number>,
    atBench: boolean
  ): CraftingRecipe[] {
    return CRAFTING_RECIPES.filter((recipe) => {
      if (recipe.requiresBench && !atBench) return false;
      if (recipe.unlockedByNPC && recipe.requiredTrust !== undefined) {
        const trust = npcTrustMap[recipe.unlockedByNPC] ?? 0;
        if (trust < recipe.requiredTrust) return false;
      }
      return true;
    });
  }

  canCraft(recipe: CraftingRecipe, inventory: Inventory): boolean {
    return recipe.ingredients.every((ing) =>
      inventory.hasItem(ing.itemId, ing.quantity)
    );
  }

  craft(recipe: CraftingRecipe, inventory: Inventory): boolean {
    if (!this.canCraft(recipe, inventory)) return false;

    for (const ing of recipe.ingredients) {
      inventory.removeItem(ing.itemId, ing.quantity);
    }

    const added = inventory.addItem(recipe.result.itemId, recipe.result.quantity);
    if (!added) {
      for (const ing of recipe.ingredients) {
        inventory.addItem(ing.itemId, ing.quantity);
      }
      return false;
    }

    EventBus.emit(Events.ITEM_CRAFTED, { recipeId: recipe.id, itemId: recipe.result.itemId });
    return true;
  }
}
