/* Copyright (c) 2017 Juri Torhoff
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import * as Long from "long";
import { ByteStream } from "../../DataStructures/ByteStream";
import { Hashable } from "../../DataStructures/HashMap/Hashable";
import { TLSerializable } from "../Interfaces/TLSerializable";
import { combineHash } from "../../DataStructures/HashMap/Combine";

export class TLLong implements TLSerializable, Hashable {
    static deserialized(data: ByteStream): TLLong | undefined {
        const bytes = data.read(8);
        if (!bytes) return undefined;

        const low =
            (bytes[3] << 24) |
            (bytes[2] << 16) |
            (bytes[1] << 8)  |
            (bytes[0]);

        const high =
            (bytes[7] << 24) |
            (bytes[6] << 16) |
            (bytes[5] << 8)  |
            (bytes[4]);

        return new TLLong(Long.fromBits(low, high));
    }

    serialized(): Uint8Array {
        const bytes = new Uint8Array(8);

        bytes[3] = (this.value.low >> 24)   & 0xff;
        bytes[2] = (this.value.low >> 16)   & 0xff;
        bytes[1] = (this.value.low >> 8)    & 0xff;
        bytes[0] =  this.value.low          & 0xff;

        bytes[7] = (this.value.high >> 24)  & 0xff;
        bytes[6] = (this.value.high >> 16)  & 0xff;
        bytes[5] = (this.value.high >> 8)   & 0xff;
        bytes[4] =  this.value.high         & 0xff;

        return bytes;
    }

    get hashValue(): number {
        return combineHash(this.value.low, this.value.high);
    }

    equals(to: TLLong): boolean {
        return this.value.equals(to.value);
    }

    constructor(readonly value: Long) {}
}