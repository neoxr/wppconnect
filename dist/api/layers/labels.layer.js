"use strict";
/*
 * This file is part of WPPConnect.
 *
 * WPPConnect is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * WPPConnect is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with WPPConnect.  If not, see <https://www.gnu.org/licenses/>.
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabelsLayer = void 0;
var helpers_1 = require("../helpers");
var catalog_layer_1 = require("./catalog.layer");
var LabelsLayer = /** @class */ (function (_super) {
    __extends(LabelsLayer, _super);
    function LabelsLayer(page, session, options) {
        var _this = _super.call(this, page, session, options) || this;
        _this.page = page;
        return _this;
    }
    /**
     * Create New Label
     * @category Labels
     *
     * @example
     * ```javascript
     * client.addNewLabel(`Name of label`);
     * //or
     * client.addNewLabel(`Name of label`, { labelColor: '#dfaef0' });
     * //or
     * client.addNewLabel(`Name of label`, { labelColor: 4292849392 });
     * ```
     * @param name Name of label
     * @param options options of label
     */
    LabelsLayer.prototype.addNewLabel = function (name, options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, helpers_1.evaluateAndReturn)(this.page, function (_a) {
                            var name = _a.name, options = _a.options;
                            WPP.labels.addNewLabel(name, options);
                        }, { name: name, options: options })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Add or delete label of chatId
     * @category Labels
     *
     * @example
     * ```javascript
     * client.addOrRemoveLabels(['[number]@c.us','[number]@c.us'],
     * [
     *   { labelId:'76', type:'add' },
     *   { labelId:'75', type:'remove' }
     * ]);
     * //or
     * ```
     * @param chatIds ChatIds
     * @param options options to remove or add
     */
    LabelsLayer.prototype.addOrRemoveLabels = function (chatIds, options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, helpers_1.evaluateAndReturn)(this.page, function (_a) {
                            var chatIds = _a.chatIds, options = _a.options;
                            WPP.labels.addOrRemoveLabels(chatIds, options);
                        }, { chatIds: chatIds, options: options })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get all Labels
     *
     * @example
     * ```javascript
     * client.getAllLabels();
     * ```
     */
    LabelsLayer.prototype.getAllLabels = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, (0, helpers_1.evaluateAndReturn)(this.page, function () { return WPP.labels.getAllLabels(); })];
            });
        });
    };
    /**
     * Get Label by id
     * @category Labels
     * @param id - Id of label
     *
     * @example
     * ```javascript
     * client.getLabelById('1');
     * ```
     */
    LabelsLayer.prototype.getLabelById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, helpers_1.evaluateAndReturn)(this.page, function (_a) {
                            var id = _a.id;
                            WPP.labels.getLabelById(id);
                        }, { id: id })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Delete all Labels
     * @category Labels
     *
     * @example
     * ```javascript
     * client.deleteAllLabels();
     * ```
     */
    LabelsLayer.prototype.deleteAllLabels = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, helpers_1.evaluateAndReturn)(this.page, function () {
                            WPP.labels.deleteAllLabels();
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Add or delete label of chatId
     * @category Labels
     *
     * @example
     * ```javascript
     * client.deleteLabel();
     * ```
     * @param id Id or string to labels to delete
     */
    LabelsLayer.prototype.deleteLabel = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, helpers_1.evaluateAndReturn)(this.page, function (_a) {
                            var id = _a.id;
                            WPP.labels.deleteLabel(id);
                        }, { id: id })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    return LabelsLayer;
}(catalog_layer_1.CatalogLayer));
exports.LabelsLayer = LabelsLayer;
