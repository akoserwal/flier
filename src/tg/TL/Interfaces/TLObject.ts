/* Copyright (c) 2017 Juri Torhoff
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { TLInt } from "../Types/TLInt";
import { TLSerializable } from "./TLSerializable";

export abstract class TLObject extends TLSerializable {
    static readonly cons: TLInt
}