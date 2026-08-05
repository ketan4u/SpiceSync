import type { DietBand, FoodItem, ItemDiet } from './types.ts';

/**
 * The Fumble food catalog.
 *
 * Every item is tagged along the axes the quiz measures, so the quiz builds its
 * own pairs from tags rather than from a hand-authored bracket. That means:
 *   - photos can be swapped in later without touching quiz logic,
 *   - adding a dish is a one-line change,
 *   - each diet band gets its own pool automatically.
 *
 * Axis conventions (all 0..1):
 *   spice      0 = no heat            1 = extra spicy
 *   richness   0 = light and clean    1 = fried / creamy / heavy
 *   novelty    0 = everyone's eaten it  1 = you have to seek it out
 *   sweetness  0 = fully savoury      1 = dessert
 *
 * `novelty` is the highest-value axis in the quiz: it tracks openness to
 * experience, which is the bridge from Section 2 to Section 3.
 */
export const FOOD_CATALOG: FoodItem[] = [
  // ---------------------------------------------------------------- vegan
  // South Indian
  { id: 'idli_sambar', name: 'Idli Sambar', blurb: 'Steamed, soft, endlessly reliable', emoji: '🍚', diet: 'vegan', cuisine: 'south_indian', spice: 0.3, richness: 0.15, novelty: 0.05, sweetness: 0.05, setting: 'home' },
  { id: 'plain_dosa', name: 'Dosa with Coconut Chutney', blurb: 'Crisp, oil-roasted, no ceremony', emoji: '🥞', diet: 'vegan', cuisine: 'south_indian', spice: 0.25, richness: 0.3, novelty: 0.05, sweetness: 0.05, setting: 'home' },
  { id: 'medu_vada', name: 'Medu Vada', blurb: 'Crunchy outside, pillowy inside', emoji: '🍩', diet: 'vegan', cuisine: 'south_indian', spice: 0.35, richness: 0.5, novelty: 0.15, sweetness: 0.05, setting: 'street' },
  { id: 'rasam_rice', name: 'Rasam Rice', blurb: 'Peppery, thin, clears your head', emoji: '🥣', diet: 'vegan', cuisine: 'south_indian', spice: 0.55, richness: 0.15, novelty: 0.2, sweetness: 0.05, setting: 'home' },
  { id: 'sambar_rice', name: 'Sambar Rice', blurb: 'The everyday comfort plate', emoji: '🍛', diet: 'vegan', cuisine: 'south_indian', spice: 0.35, richness: 0.25, novelty: 0.1, sweetness: 0.05, setting: 'home' },
  { id: 'lemon_rice', name: 'Lemon Rice', blurb: 'Tangy, yellow, travels well', emoji: '🍋', diet: 'vegan', cuisine: 'south_indian', spice: 0.25, richness: 0.2, novelty: 0.15, sweetness: 0.05, setting: 'home' },
  { id: 'ragi_mudde', name: 'Ragi Mudde with Saaru', blurb: 'Swallow, do not chew', emoji: '🟤', diet: 'vegan', cuisine: 'south_indian', spice: 0.5, richness: 0.2, novelty: 0.5, sweetness: 0.05, setting: 'home' },
  { id: 'appam_stew', name: 'Appam with Veg Stew', blurb: 'Lacy edges, coconut milk', emoji: '🥥', diet: 'vegan', cuisine: 'south_indian', spice: 0.15, richness: 0.35, novelty: 0.35, sweetness: 0.15, setting: 'restaurant' },
  { id: 'puttu_kadala', name: 'Puttu & Kadala Curry', blurb: 'Steamed rice cylinders, black chana', emoji: '🥁', diet: 'vegan', cuisine: 'south_indian', spice: 0.4, richness: 0.3, novelty: 0.45, sweetness: 0.05, setting: 'home' },
  { id: 'akki_roti', name: 'Akki Roti', blurb: 'Rice flour, patted by hand', emoji: '🫓', diet: 'vegan', cuisine: 'south_indian', spice: 0.35, richness: 0.35, novelty: 0.5, sweetness: 0.05, setting: 'home' },
  { id: 'sundal', name: 'Sundal', blurb: 'Beach snack in a paper cone', emoji: '🫘', diet: 'vegan', cuisine: 'south_indian', spice: 0.3, richness: 0.15, novelty: 0.4, sweetness: 0.05, setting: 'street' },
  { id: 'upma', name: 'Upma', blurb: 'Divisive. You know which side you are on', emoji: '🥘', diet: 'vegan', cuisine: 'south_indian', spice: 0.2, richness: 0.25, novelty: 0.15, sweetness: 0.05, setting: 'home' },

  // North Indian
  { id: 'chole', name: 'Chole', blurb: 'Dark, tangy, slow-cooked chickpeas', emoji: '🍲', diet: 'vegan', cuisine: 'north_indian', spice: 0.5, richness: 0.5, novelty: 0.1, sweetness: 0.05, setting: 'home' },
  { id: 'rajma_chawal', name: 'Rajma Chawal', blurb: 'Sunday afternoon, food coma guaranteed', emoji: '🫘', diet: 'vegan', cuisine: 'north_indian', spice: 0.35, richness: 0.45, novelty: 0.05, sweetness: 0.05, setting: 'home' },
  { id: 'aloo_gobi', name: 'Aloo Gobi', blurb: 'No drama, just dinner', emoji: '🥔', diet: 'vegan', cuisine: 'north_indian', spice: 0.35, richness: 0.4, novelty: 0.1, sweetness: 0.05, setting: 'home' },
  { id: 'baingan_bharta', name: 'Baingan Bharta', blurb: 'Smoked over open flame', emoji: '🍆', diet: 'vegan', cuisine: 'north_indian', spice: 0.45, richness: 0.45, novelty: 0.3, sweetness: 0.05, setting: 'home' },
  { id: 'jackfruit_biryani', name: 'Kathal Biryani', blurb: 'Jackfruit that fools everyone', emoji: '🍈', diet: 'vegan', cuisine: 'north_indian', spice: 0.6, richness: 0.6, novelty: 0.7, sweetness: 0.05, setting: 'restaurant' },

  // Street
  { id: 'pani_puri', name: 'Pani Puri', blurb: 'One more. Always one more', emoji: '💦', diet: 'vegan', cuisine: 'street', spice: 0.6, richness: 0.3, novelty: 0.1, sweetness: 0.25, setting: 'street' },
  { id: 'bhel_puri', name: 'Bhel Puri', blurb: 'Crunchy, sweet, sour, gone in a minute', emoji: '🥗', diet: 'vegan', cuisine: 'street', spice: 0.4, richness: 0.25, novelty: 0.1, sweetness: 0.2, setting: 'street' },
  { id: 'sev_puri', name: 'Sev Puri', blurb: 'Assembled in front of you, eaten standing', emoji: '🧆', diet: 'vegan', cuisine: 'street', spice: 0.45, richness: 0.35, novelty: 0.15, sweetness: 0.2, setting: 'street' },
  { id: 'chana_chaat', name: 'Chana Chaat', blurb: 'Lemon, onion, green chilli', emoji: '🥣', diet: 'vegan', cuisine: 'street', spice: 0.45, richness: 0.3, novelty: 0.2, sweetness: 0.15, setting: 'street' },

  // West Indian
  { id: 'vada_pav', name: 'Vada Pav', blurb: 'The whole city runs on it', emoji: '🍔', diet: 'vegan', cuisine: 'west_indian', spice: 0.5, richness: 0.55, novelty: 0.1, sweetness: 0.05, setting: 'street' },
  { id: 'misal_pav', name: 'Misal Pav', blurb: 'Red oil on top. That is the warning', emoji: '🌶️', diet: 'vegan', cuisine: 'west_indian', spice: 0.9, richness: 0.55, novelty: 0.3, sweetness: 0.05, setting: 'street' },
  { id: 'poha', name: 'Poha', blurb: 'Breakfast in eleven minutes', emoji: '🍚', diet: 'vegan', cuisine: 'west_indian', spice: 0.25, richness: 0.25, novelty: 0.1, sweetness: 0.1, setting: 'home' },
  { id: 'thepla', name: 'Thepla', blurb: 'Survives four days of travel', emoji: '🫓', diet: 'vegan', cuisine: 'west_indian', spice: 0.25, richness: 0.3, novelty: 0.35, sweetness: 0.1, setting: 'home' },
  { id: 'dhokla', name: 'Dhokla', blurb: 'Spongy, steamed, faintly sweet', emoji: '🟡', diet: 'vegan', cuisine: 'west_indian', spice: 0.2, richness: 0.2, novelty: 0.3, sweetness: 0.25, setting: 'home' },
  { id: 'undhiyu', name: 'Undhiyu', blurb: 'Winter only. Nine vegetables deep', emoji: '🥕', diet: 'vegan', cuisine: 'west_indian', spice: 0.45, richness: 0.6, novelty: 0.6, sweetness: 0.15, setting: 'home' },
  { id: 'sol_kadhi', name: 'Sol Kadhi', blurb: 'Pink, cooling, kokum and coconut', emoji: '🩷', diet: 'vegan', cuisine: 'west_indian', spice: 0.2, richness: 0.2, novelty: 0.55, sweetness: 0.2, setting: 'restaurant' },

  // Indo-Chinese
  { id: 'veg_hakka_noodles', name: 'Veg Hakka Noodles', blurb: 'Wok smoke and cabbage', emoji: '🍜', diet: 'vegan', cuisine: 'indo_chinese', spice: 0.35, richness: 0.45, novelty: 0.1, sweetness: 0.05, setting: 'street' },
  { id: 'veg_manchurian', name: 'Veg Manchurian', blurb: 'Invented in Bombay, obviously', emoji: '🟠', diet: 'vegan', cuisine: 'indo_chinese', spice: 0.5, richness: 0.6, novelty: 0.15, sweetness: 0.1, setting: 'restaurant' },
  { id: 'gobi_65', name: 'Gobi 65', blurb: 'Cauliflower with something to prove', emoji: '🥦', diet: 'vegan', cuisine: 'indo_chinese', spice: 0.7, richness: 0.6, novelty: 0.25, sweetness: 0.05, setting: 'restaurant' },
  { id: 'schezwan_fried_rice', name: 'Schezwan Fried Rice', blurb: 'Nothing to do with Sichuan', emoji: '🍚', diet: 'vegan', cuisine: 'indo_chinese', spice: 0.75, richness: 0.5, novelty: 0.2, sweetness: 0.05, setting: 'street' },

  // Continental / café
  { id: 'arrabbiata', name: 'Penne Arrabbiata', blurb: 'Angry tomatoes, garlic, chilli', emoji: '🍝', diet: 'vegan', cuisine: 'continental', spice: 0.5, richness: 0.45, novelty: 0.25, sweetness: 0.05, setting: 'cafe' },
  { id: 'avocado_toast', name: 'Avocado Toast', blurb: 'Sourdough, chilli flakes, ₹450', emoji: '🥑', diet: 'vegan', cuisine: 'continental', spice: 0.1, richness: 0.35, novelty: 0.45, sweetness: 0.1, setting: 'cafe' },
  { id: 'hummus_pita', name: 'Hummus & Pita', blurb: 'Olive oil pooled in the middle', emoji: '🫓', diet: 'vegan', cuisine: 'continental', spice: 0.15, richness: 0.35, novelty: 0.5, sweetness: 0.05, setting: 'cafe' },
  { id: 'falafel_wrap', name: 'Falafel Wrap', blurb: 'Tahini everywhere, no regrets', emoji: '🌯', diet: 'vegan', cuisine: 'continental', spice: 0.3, richness: 0.5, novelty: 0.45, sweetness: 0.05, setting: 'street' },

  // Pan-Asian
  { id: 'veg_sushi', name: 'Avocado Maki', blurb: 'Cold rice, and that is the point', emoji: '🍣', diet: 'vegan', cuisine: 'pan_asian', spice: 0.1, richness: 0.25, novelty: 0.65, sweetness: 0.1, setting: 'restaurant' },
  { id: 'veg_pad_thai', name: 'Veg Pad Thai', blurb: 'Tamarind, peanut, lime wedge', emoji: '🥜', diet: 'vegan', cuisine: 'pan_asian', spice: 0.45, richness: 0.5, novelty: 0.55, sweetness: 0.2, setting: 'restaurant' },
  { id: 'veg_momos', name: 'Veg Momos', blurb: 'The chutney is the actual dish', emoji: '🥟', diet: 'vegan', cuisine: 'pan_asian', spice: 0.35, richness: 0.35, novelty: 0.2, sweetness: 0.05, setting: 'street' },
  { id: 'tofu_ramen', name: 'Miso Tofu Ramen', blurb: 'Twenty minutes of silence', emoji: '🍜', diet: 'vegan', cuisine: 'pan_asian', spice: 0.3, richness: 0.5, novelty: 0.7, sweetness: 0.05, setting: 'restaurant' },

  // Vegan sweets — needed so the sweetness axis is measurable inside the vegan pool
  { id: 'jalebi', name: 'Jalebi', blurb: 'Fried, syrup-soaked, structurally unsound', emoji: '🍥', diet: 'vegan', cuisine: 'street', spice: 0, richness: 0.8, novelty: 0.1, sweetness: 0.95, setting: 'street' },
  { id: 'banana_halwa', name: 'Banana Halwa', blurb: 'Coconut oil, jaggery, patience', emoji: '🍌', diet: 'vegan', cuisine: 'south_indian', spice: 0, richness: 0.75, novelty: 0.55, sweetness: 0.9, setting: 'home' },

  // ------------------------------------------------------------ vegetarian
  { id: 'pav_bhaji', name: 'Pav Bhaji', blurb: 'A brick of butter, non-negotiable', emoji: '🧈', diet: 'vegetarian', cuisine: 'west_indian', spice: 0.55, richness: 0.7, novelty: 0.1, sweetness: 0.1, setting: 'street' },
  { id: 'paneer_butter_masala', name: 'Paneer Butter Masala', blurb: 'The safe order, and it knows it', emoji: '🧀', diet: 'vegetarian', cuisine: 'north_indian', spice: 0.35, richness: 0.85, novelty: 0.05, sweetness: 0.15, setting: 'restaurant' },
  { id: 'chilli_paneer', name: 'Chilli Paneer', blurb: 'Dry or gravy — pick a side', emoji: '🌶️', diet: 'vegetarian', cuisine: 'indo_chinese', spice: 0.7, richness: 0.6, novelty: 0.2, sweetness: 0.05, setting: 'restaurant' },
  { id: 'aloo_paratha', name: 'Aloo Paratha', blurb: 'With white butter melting off the edge', emoji: '🫓', diet: 'vegetarian', cuisine: 'north_indian', spice: 0.3, richness: 0.6, novelty: 0.05, sweetness: 0.05, setting: 'home' },
  { id: 'dal_tadka', name: 'Dal Tadka', blurb: 'The tadka poured on at the table', emoji: '🥣', diet: 'vegetarian', cuisine: 'north_indian', spice: 0.4, richness: 0.45, novelty: 0.05, sweetness: 0.05, setting: 'home' },
  { id: 'curd_rice', name: 'Curd Rice', blurb: 'The last course, always', emoji: '🍚', diet: 'vegetarian', cuisine: 'south_indian', spice: 0.1, richness: 0.3, novelty: 0.1, sweetness: 0.1, setting: 'home' },
  { id: 'veg_biryani', name: 'Veg Biryani', blurb: 'Yes, it counts. Move on', emoji: '🍚', diet: 'vegetarian', cuisine: 'mughlai', spice: 0.55, richness: 0.65, novelty: 0.15, sweetness: 0.05, setting: 'restaurant' },
  { id: 'bisi_bele_bath', name: 'Bisi Bele Bath', blurb: 'Hot, sour, ghee on top, boondi on the side', emoji: '🍛', diet: 'vegetarian', cuisine: 'south_indian', spice: 0.55, richness: 0.5, novelty: 0.4, sweetness: 0.05, setting: 'home' },
  { id: 'ghee_roast_dosa', name: 'Ghee Roast Dosa', blurb: 'You can hear it from the next table', emoji: '🥞', diet: 'vegetarian', cuisine: 'south_indian', spice: 0.35, richness: 0.55, novelty: 0.1, sweetness: 0.05, setting: 'home' },
  { id: 'litti_chokha', name: 'Litti Chokha', blurb: 'Charred, dunked in ghee, eaten with hands', emoji: '🔥', diet: 'vegetarian', cuisine: 'bengali_east', spice: 0.5, richness: 0.55, novelty: 0.55, sweetness: 0.05, setting: 'street' },
  { id: 'khichdi', name: 'Khichdi', blurb: 'What you eat when nothing is going right', emoji: '🍲', diet: 'vegetarian', cuisine: 'north_indian', spice: 0.15, richness: 0.35, novelty: 0.05, sweetness: 0.05, setting: 'home' },
  { id: 'margherita_pizza', name: 'Margherita Pizza', blurb: 'Three ingredients, nowhere to hide', emoji: '🍕', diet: 'vegetarian', cuisine: 'continental', spice: 0.1, richness: 0.6, novelty: 0.15, sweetness: 0.1, setting: 'cafe' },
  { id: 'white_sauce_pasta', name: 'White Sauce Pasta', blurb: 'Comfort, and a lot of it', emoji: '🍝', diet: 'vegetarian', cuisine: 'continental', spice: 0.05, richness: 0.7, novelty: 0.15, sweetness: 0.1, setting: 'cafe' },
  { id: 'filter_coffee', name: 'Filter Coffee', blurb: 'Poured between tumbler and davara', emoji: '☕', diet: 'vegetarian', cuisine: 'south_indian', spice: 0, richness: 0.3, novelty: 0.05, sweetness: 0.35, setting: 'cafe' },
  { id: 'gulab_jamun', name: 'Gulab Jamun', blurb: 'Warm, and it should be warm', emoji: '🟤', diet: 'vegetarian', cuisine: 'north_indian', spice: 0, richness: 0.85, novelty: 0.05, sweetness: 1, setting: 'restaurant' },
  { id: 'nolen_gur_sandesh', name: 'Nolen Gur Sandesh', blurb: 'Winter palm jaggery, gone by February', emoji: '🤍', diet: 'vegetarian', cuisine: 'bengali_east', spice: 0, richness: 0.5, novelty: 0.5, sweetness: 0.9, setting: 'home' },
  { id: 'mysore_pak', name: 'Mysore Pak', blurb: 'Ghee held together by hope', emoji: '🟨', diet: 'vegetarian', cuisine: 'south_indian', spice: 0, richness: 0.9, novelty: 0.3, sweetness: 0.95, setting: 'home' },
  { id: 'rabri_falooda', name: 'Rabri Falooda', blurb: 'A dessert that needs a spoon and a straw', emoji: '🍨', diet: 'vegetarian', cuisine: 'mughlai', spice: 0, richness: 0.9, novelty: 0.35, sweetness: 0.95, setting: 'street' },
  { id: 'shrikhand', name: 'Shrikhand', blurb: 'Hung curd, saffron, cardamom', emoji: '🥭', diet: 'vegetarian', cuisine: 'west_indian', spice: 0, richness: 0.6, novelty: 0.45, sweetness: 0.85, setting: 'home' },

  // ------------------------------------------------------------------- egg
  { id: 'egg_bhurji', name: 'Egg Bhurji', blurb: 'Made on a cart at 1am', emoji: '🍳', diet: 'egg', cuisine: 'north_indian', spice: 0.5, richness: 0.5, novelty: 0.1, sweetness: 0.05, setting: 'street' },
  { id: 'anda_curry', name: 'Anda Curry', blurb: 'Boiled eggs, scored and fried first', emoji: '🥚', diet: 'egg', cuisine: 'north_indian', spice: 0.5, richness: 0.55, novelty: 0.25, sweetness: 0.05, setting: 'home' },

  // --------------------------------------------------------------- non-veg
  { id: 'chicken_biryani', name: 'Hyderabadi Chicken Biryani', blurb: 'Dum sealed, mirchi ka salan alongside', emoji: '🍗', diet: 'non_veg', cuisine: 'mughlai', spice: 0.7, richness: 0.7, novelty: 0.1, sweetness: 0.05, setting: 'restaurant' },
  { id: 'donne_biryani', name: 'Donne Biryani', blurb: 'Served in a leaf cup, eaten fast', emoji: '🍲', diet: 'non_veg', cuisine: 'south_indian', spice: 0.75, richness: 0.75, novelty: 0.3, sweetness: 0.05, setting: 'restaurant' },
  { id: 'butter_chicken', name: 'Butter Chicken', blurb: 'Sweet, creamy, universally ordered', emoji: '🍛', diet: 'non_veg', cuisine: 'north_indian', spice: 0.3, richness: 0.9, novelty: 0.05, sweetness: 0.15, setting: 'restaurant' },
  { id: 'chicken_65', name: 'Chicken 65', blurb: 'Red, curry leaves, no explanation', emoji: '🔴', diet: 'non_veg', cuisine: 'south_indian', spice: 0.8, richness: 0.6, novelty: 0.2, sweetness: 0.05, setting: 'restaurant' },
  { id: 'ghee_roast_chicken', name: 'Kundapur Ghee Roast', blurb: 'Byadgi chillies, ghee, absolute violence', emoji: '🌶️', diet: 'non_veg', cuisine: 'south_indian', spice: 0.95, richness: 0.8, novelty: 0.5, sweetness: 0.05, setting: 'restaurant' },
  { id: 'chettinad_chicken', name: 'Chettinad Chicken', blurb: 'Black pepper and roasted spice', emoji: '⚫', diet: 'non_veg', cuisine: 'south_indian', spice: 0.9, richness: 0.65, novelty: 0.4, sweetness: 0.05, setting: 'restaurant' },
  { id: 'meen_varuval', name: 'Meen Varuval', blurb: 'Fish fry, semolina crust, lime', emoji: '🐟', diet: 'non_veg', cuisine: 'south_indian', spice: 0.75, richness: 0.55, novelty: 0.35, sweetness: 0.05, setting: 'street' },
  { id: 'kerala_beef_fry', name: 'Kerala Beef Fry', blurb: 'Coconut slivers, curry leaf, black pepper', emoji: '🥩', diet: 'non_veg', cuisine: 'south_indian', spice: 0.8, richness: 0.7, novelty: 0.7, sweetness: 0.05, setting: 'restaurant' },
  { id: 'mutton_rogan_josh', name: 'Rogan Josh', blurb: 'Kashmiri chilli for colour, not heat', emoji: '🍖', diet: 'non_veg', cuisine: 'mughlai', spice: 0.55, richness: 0.8, novelty: 0.35, sweetness: 0.05, setting: 'restaurant' },
  { id: 'kosha_mangsho', name: 'Kosha Mangsho', blurb: 'Cooked down for three hours', emoji: '🍖', diet: 'non_veg', cuisine: 'bengali_east', spice: 0.65, richness: 0.8, novelty: 0.5, sweetness: 0.05, setting: 'home' },
  { id: 'macher_jhol', name: 'Macher Jhol', blurb: 'Thin, mustard-sharp, with rice', emoji: '🐠', diet: 'non_veg', cuisine: 'bengali_east', spice: 0.45, richness: 0.4, novelty: 0.45, sweetness: 0.05, setting: 'home' },
  { id: 'pork_vindaloo', name: 'Pork Vindaloo', blurb: 'Vinegar, garlic, and real heat', emoji: '🐖', diet: 'non_veg', cuisine: 'west_indian', spice: 0.85, richness: 0.75, novelty: 0.65, sweetness: 0.1, setting: 'restaurant' },
  { id: 'prawn_koliwada', name: 'Prawn Koliwada', blurb: 'Orange batter, eaten by the sea', emoji: '🦐', diet: 'non_veg', cuisine: 'west_indian', spice: 0.7, richness: 0.6, novelty: 0.5, sweetness: 0.05, setting: 'street' },
  { id: 'tandoori_chicken', name: 'Tandoori Chicken', blurb: 'Arrives sizzling, onion rings on top', emoji: '🍗', diet: 'non_veg', cuisine: 'north_indian', spice: 0.5, richness: 0.55, novelty: 0.1, sweetness: 0.05, setting: 'restaurant' },
  { id: 'seekh_kebab', name: 'Seekh Kebab', blurb: 'Off the skewer, into the roomali', emoji: '🍢', diet: 'non_veg', cuisine: 'mughlai', spice: 0.55, richness: 0.65, novelty: 0.2, sweetness: 0.05, setting: 'street' },
  { id: 'galouti_kebab', name: 'Galouti Kebab', blurb: 'Dissolves before you finish chewing', emoji: '🟫', diet: 'non_veg', cuisine: 'mughlai', spice: 0.45, richness: 0.8, novelty: 0.6, sweetness: 0.05, setting: 'restaurant' },
  { id: 'nihari', name: 'Nihari', blurb: 'Breakfast, if you are serious about it', emoji: '🥘', diet: 'non_veg', cuisine: 'mughlai', spice: 0.6, richness: 0.95, novelty: 0.75, sweetness: 0.05, setting: 'street' },
  { id: 'haleem', name: 'Haleem', blurb: 'Pounded for hours, only in Ramzan', emoji: '🥣', diet: 'non_veg', cuisine: 'mughlai', spice: 0.5, richness: 0.85, novelty: 0.7, sweetness: 0.05, setting: 'street' },
  { id: 'keema_pav', name: 'Keema Pav', blurb: 'Minced, buttery, best before noon', emoji: '🍞', diet: 'non_veg', cuisine: 'mughlai', spice: 0.55, richness: 0.7, novelty: 0.3, sweetness: 0.05, setting: 'street' },
  { id: 'bheja_fry', name: 'Bheja Fry', blurb: 'You either grew up on it or you did not', emoji: '🧠', diet: 'non_veg', cuisine: 'mughlai', spice: 0.7, richness: 0.8, novelty: 1, sweetness: 0.05, setting: 'restaurant' },
  { id: 'chilli_chicken', name: 'Chilli Chicken', blurb: 'The default order, and it never misses', emoji: '🌶️', diet: 'non_veg', cuisine: 'indo_chinese', spice: 0.75, richness: 0.6, novelty: 0.15, sweetness: 0.05, setting: 'restaurant' },
  { id: 'chicken_momos', name: 'Chicken Momos', blurb: 'Steamed, ten to a plate', emoji: '🥟', diet: 'non_veg', cuisine: 'pan_asian', spice: 0.4, richness: 0.4, novelty: 0.2, sweetness: 0.05, setting: 'street' },
  { id: 'salmon_sushi', name: 'Salmon Nigiri', blurb: 'Raw fish, and you are fine with that', emoji: '🍣', diet: 'non_veg', cuisine: 'pan_asian', spice: 0.05, richness: 0.35, novelty: 0.75, sweetness: 0.1, setting: 'restaurant' },
  { id: 'tonkotsu_ramen', name: 'Tonkotsu Ramen', blurb: 'Pork bone broth, twelve hours', emoji: '🍜', diet: 'non_veg', cuisine: 'pan_asian', spice: 0.3, richness: 0.7, novelty: 0.7, sweetness: 0.05, setting: 'restaurant' },
  { id: 'fried_chicken_burger', name: 'Fried Chicken Burger', blurb: 'Napkins will not be enough', emoji: '🍔', diet: 'non_veg', cuisine: 'continental', spice: 0.35, richness: 0.75, novelty: 0.15, sweetness: 0.1, setting: 'cafe' },
  { id: 'butter_garlic_prawns', name: 'Butter Garlic Prawns', blurb: 'Mop the plate with the bread', emoji: '🧄', diet: 'non_veg', cuisine: 'continental', spice: 0.2, richness: 0.7, novelty: 0.5, sweetness: 0.05, setting: 'restaurant' },
];

/**
 * Which item diets each band is allowed to see, and how heavily to sample them.
 *
 * SAFETY-CRITICAL: `vegan` and `all_veg` must never surface an egg or non-veg
 * item, in any round, ever. That is asserted in the verification script — it is
 * the single most damaging bug this quiz could ship.
 */
export const DIET_BAND_POOL: Record<DietBand, Partial<Record<ItemDiet, number>>> = {
  vegan: { vegan: 1 },
  all_veg: { vegan: 1, vegetarian: 1 },
  mostly_veg: { vegan: 1, vegetarian: 1, egg: 0.7, non_veg: 0.25 },
  mostly_non_veg: { vegan: 0.8, vegetarian: 0.8, egg: 1, non_veg: 1 },
  generally_non_veg: { vegan: 0.5, vegetarian: 0.6, egg: 1, non_veg: 1 },
  eats_anything: { vegan: 1, vegetarian: 1, egg: 1, non_veg: 1 },
};

const poolCache = new Map<DietBand, FoodItem[]>();

/** Items a band may be shown, in catalog order. Memoised — this is called
 *  several times per round and rebuilding the filtered array dominated the
 *  calibration run. Treat the result as read-only. */
export function poolFor(band: DietBand): FoodItem[] {
  let pool = poolCache.get(band);
  if (!pool) {
    const allowed = DIET_BAND_POOL[band];
    pool = FOOD_CATALOG.filter((item) => (allowed[item.diet] ?? 0) > 0);
    poolCache.set(band, pool);
  }
  return pool;
}

/** Sampling weight for an item within a band. Used to bias, never to exclude. */
export function bandWeight(band: DietBand, item: FoodItem): number {
  return DIET_BAND_POOL[band][item.diet] ?? 0;
}

export const ITEMS_BY_ID: Map<string, FoodItem> = new Map(
  FOOD_CATALOG.map((item) => [item.id, item]),
);

export function getItem(id: string): FoodItem {
  const item = ITEMS_BY_ID.get(id);
  if (!item) throw new Error(`Unknown food item: ${id}`);
  return item;
}
