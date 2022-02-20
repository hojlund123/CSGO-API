import * as VDF from "vdf-parser";
import axios from "axios";
import {
    ITEMS_GAME_URL,
    CSGO_ENGLISH_URL,
    IMAGES_BASE_URL,
} from "../utils/config.js";
import { getWeaponName } from "../utils/weapons.js";

const getTranslation = (translations, key) => {
    const translation = translations[key?.replace("#", "").toLowerCase()];

    if (translation === undefined || translation === "") return null;

    return translation;
};

const skinsCollections = async () => {
    const itemSets = await itemsGame().then(
        (response) => response.items_game.item_sets
    );
    const allTranslation = await translations();

    const result = {};

    for (const values of Object.values(itemSets)) {
        for (const value of Object.values(values)) {
            if (value.is_collection) {
                const keys = Object.keys(value.items).map((item) => {
                    const pattern = item.match(/\[(.*?)\]/i);

                    if (pattern) {
                        return pattern[1];
                    }

                    return item;
                });

                keys.forEach((item) => {
                    result[item.toLocaleLowerCase()] = {
                        id: value.name.replace("#CSGO_", ""),
                        name: getTranslation(allTranslation, value.name),
                    };
                });
            }
        }
    }

    return result;
};

export const itemsGame = async () => {
    const data = await axios
        .get(ITEMS_GAME_URL)
        .then((response) => response.data);

    return VDF.parse(data);
};

export const translations = async () => {
    const data = await axios
        .get(CSGO_ENGLISH_URL)
        .then((response) => response.data);

    const parsed = VDF.parse(data);

    const lowerCaseKeys = Object.fromEntries(
        Object.entries(parsed.lang.Tokens).map(([key, val]) => [
            key.toLowerCase(),
            val,
        ])
    );

    return lowerCaseKeys;
};

export const prefabs = async () => {
    const prefabs = await itemsGame().then(
        (response) => response.items_game.prefabs
    );
    const allTranslation = await translations();
    const results = [];

    for (const values of Object.values(prefabs)) {
        for (const [weapon, prefab] of Object.entries(values)) {
            if (prefab.item_name === undefined) continue;

            results[weapon] = getTranslation(allTranslation, prefab.item_name);
        }
    }

    return results;
};

export const paintKits = async () => {
    const paintKits = await itemsGame().then(
        (response) => response.items_game.paint_kits
    );
    const allTranslation = await translations();
    const results = [];

    for (const values of Object.values(paintKits)) {
        for (const paint of Object.values(values)) {
            if (paint.description_tag === undefined) continue;

            results[paint.name.toLowerCase()] =
                getTranslation(allTranslation, paint.description_tag) ||
                getTranslation(
                    allTranslation,
                    `paintkit_${paint.description_tag}`
                );
        }
    }

    return results;
};

export const items = async () => {
    const items = await itemsGame().then(
        (response) => response.items_game.items
    );
    const allPrefabs = await prefabs();
    const allTranslation = await translations();
    const results = [];

    for (const values of Object.values(items)) {
        for (const item of Object.values(values)) {
            if (item.item_name === undefined) {
                if (item.prefab) {
                    results[item.name] = {
                        ...item,
                        translation_name: allPrefabs[item.prefab],
                        translation_description: null,
                    };
                }

                continue;
            }

            results[item.name] = {
                ...item,
                translation_name: getTranslation(
                    allTranslation,
                    item.item_name
                ),
                translation_description: getTranslation(
                    allTranslation,
                    item.item_description
                ),
            };
        }
    }

    return results;
};

export const skins = async () => {
    const weaponIcons = await itemsGame().then(
        (response) => response.items_game.alternate_icons2.weapon_icons
    );
    const allItems = await items();
    const allPaintKits = await paintKits();
    const allSkinsCollections = await skinsCollections();

    const results = [];

    for (const values of Object.values(weaponIcons)) {
        const path = values.icon_path.toLowerCase();
        const regex = /econ\/default_generated\/(.*?)_light$/i;

        if (regex.test(path)) {
            const name = path.match(regex);
            const weapon = getWeaponName(name[1]);

            if (weapon) {
                const pattern = name[1]
                    .replace(`${weapon}_`, "")
                    .replace("silencer_", "")
                    .toLowerCase();

                const translatedName =
                    allItems[weapon]?.translation_name ||
                    allItems[`sfui_wpnhud_${weapon.replace("weapon_", "")}`]
                        ?.translation_name;

                const image = `${IMAGES_BASE_URL}${path}_large.png`;

                results.push({
                    id: `${weapon}_${pattern}`,
                    collection_id: allSkinsCollections[pattern]?.id ?? null,
                    name: `${translatedName} | ${allPaintKits[pattern]}`,
                    weapon: translatedName,
                    pattern: allPaintKits[pattern] ?? null,
                    image,
                });
            }
        }
    }

    return results;
};

export const collectibles = async () => {
    const allItems = await items();
    const result = [];

    for (const values of Object.values(allItems)) {
        if (values.item_name === undefined) continue;
        if (values.item_name?.indexOf("#CSGO_Collectible") !== -1) {
            result.push({
                id: values.item_name.replace("#CSGO_", ""),
                name: values.translation_name,
                description: values.translation_description,
                image: `${IMAGES_BASE_URL}${values.image_inventory}.png`,
            });
        }
    }

    return result;
};

export const stickers = async () => {
    const allItemsGame = await itemsGame().then(
        (response) => response.items_game.sticker_kits
    );
    const allTranslation = await translations();
    const result = [];

    for (const stickers of Object.values(allItemsGame)) {
        for (const [key, sticker] of Object.entries(stickers)) {
            if (sticker.sticker_material === undefined) continue;
            if (sticker.item_name.indexOf("#StickerKit_") === -1) continue;
            if (sticker.name.indexOf("graffiti") !== -1) continue;

            const name = `Sticker | ${getTranslation(
                allTranslation,
                sticker.item_name
            )}`;
            const description = getTranslation(
                allTranslation,
                sticker.description_string
            );
            const rarity = getTranslation(
                allTranslation,
                `rarity_${sticker.item_rarity?.toLowerCase()}`
            );
            const image = `${IMAGES_BASE_URL}econ/stickers/${sticker.sticker_material.toLowerCase()}_large.png`;

            result.push({
                id: sticker.item_name.replace("#StickerKit_", ""),
                name,
                description,
                rarity,
                image,
            });
        }
    }

    return result;
};

export const collections = async () => {
    const itemSets = await itemsGame().then(
        (response) => response.items_game.item_sets
    );
    const allTranslation = await translations();

    const result = [];

    for (const values of Object.values(itemSets)) {
        for (const value of Object.values(values)) {
            if (value.is_collection) {
                result.push({
                    id: value.name.replace("#CSGO_", ""),
                    name: getTranslation(allTranslation, value.name),
                    image: `${IMAGES_BASE_URL}econ/set_icons/${value.name.replace(
                        "#CSGO_",
                        ""
                    )}.png`,
                });
            }
        }
    }

    return result;
};

export const cases = async () => {
    const allItems = await items();
    const allTranslation = await translations();
    const result = [];

    for (const value of Object.values(allItems)) {
        if (
            value.item_name !== undefined &&
            value.item_name.indexOf("#CSGO_crate") !== -1
        ) {
            if (value.prefab.indexOf("weapon_case_key") === -1) {
                result.push({
                    id: value.item_name.replace("#CSGO_crate_", ""),
                    collection_id: value.tags?.ItemSet?.tag_value ?? null,
                    name: getTranslation(allTranslation, value.item_name),
                    description: value.translation_description,
                    image: `${IMAGES_BASE_URL}${value.image_inventory.toLowerCase()}.png`,
                });
            }
        }
    }

    return result;
};

export const keys = async () => {
    const allItems = await items();
    const allTranslation = await translations();
    const result = [];

    for (const value of Object.values(allItems)) {
        if (
            value.item_name !== undefined &&
            value.item_name.indexOf("#CSGO_crate") !== -1
        ) {
            if (value.prefab.indexOf("weapon_case_key") !== -1) {
                if (value.item_name.indexOf("contestwinner") !== -1) continue;

                result.push({
                    id: value.item_name.replace("#CSGO_crate_", ""),
                    case_id:
                        value.tool?.restriction?.replace("crate_", "") ?? null,
                    name: getTranslation(allTranslation, value.item_name),
                    description: value.translation_description,
                    image: `${IMAGES_BASE_URL}${value.image_inventory.toLowerCase()}.png`,
                });
            }
        }
    }

    return result;
};
