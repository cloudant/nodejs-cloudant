// Copyright © 2019 IBM Corp. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as nano from 'nano';
import { CoreOptions } from 'request';

declare function cloudant(
    config: cloudant.Configuration | string,
    callback?: (error?: cloudant.CloudantError, client?: cloudant.ServerScope, pong?: any) => void
): cloudant.ServerScope;

declare namespace cloudant {
    interface ApiKey {
        key: string;
        password: string;
    }

    interface CloudantError extends Error {
        // need the additional error stuff here
        message: string
        scope: 'couch',
        statusCode: number,
        request: any,
        headers: {[key: string]: string},
        errid: string
    }

    interface Configuration {
        account?: string;
        password?: string;
        vcapInstanceName?: string;
        vcapServices?: string;
        url?: string;
        cookie?: string;
        requestDefaults?: CoreOptions;
        log?(id: string, args: any): void;
        parseUrl?: boolean;
        request?(params: any): void;
        plugins?: any;
        maxAttempt?: number;
    }

    interface CORS {
        enable_cors: boolean;
        allow_credentials: boolean;
        origins: string[];
    }

    interface GeoGeometry {
        type: "Point" | "LineString" | "Polygon" | "MultiPoint" |
            "MultiLineString" | "MultiPolygon" | "GeometryCollection",
        coordinates: number[]
    }

    interface GeoJson {
        type: "Feature",
        geometry: GeoGeometry,
        properties?: any
    }

    interface GeoDocument extends GeoJson, nano.Document {
    }

    interface GeoParams {
        include_docs?: boolean;
        bookmark?: string;
        format?: string;
        limit?: number;
        skip?: number;
        stale?: string;
        bbox?: number[];
        lat?: number;
        lon?: number;
        rangex?: number;
        rangey?: number;
        radius?: number;
        g?: any;
        relation?: string;
        nearest?: boolean;
    }

    interface GeoResult<D> {
        bookmark: string;
        features?: any[];
        rows?: D[];
        type: string;
    }

    interface QueryCreatedResponse {
        result: "created"
    }

    interface TextIndexDefinition {
        type: "text",
        name: string,
        ddoc: string,
        index: {
            default_field?: {
                enabled: boolean,
                analyzer: string,
            },
            selector?: any,
            fields: {
                name: string,
                type: 'boolean' | 'string' | 'number'
            }
        }
    }

    interface JSONIndexDefinition {
        index: {
            fields: (string | {[key: string]: 'asc'| 'desc'}) [],
            partial_filter_selector?: {} // query def
        },
        name: string,
        ddoc?: string,
        type?: 'json' | 'text'
    }

    interface IndexesResponse {
        indexes: (TextIndexDefinition|JSONIndexDefinition)[]
    }

    interface Query {
        // https://console.bluemix.net/docs/services/Cloudant/api/cloudant_query.html#query
        (definition?: TextIndexDefinition | JSONIndexDefinition, callback?: nano.Callback<QueryCreatedResponse>): Promise<QueryCreatedResponse>; //creates index
        (callback?: nano.Callback<QueryCreatedResponse>): Promise<IndexesResponse>; //reads index

        // https://console.bluemix.net/docs/services/Cloudant/api/cloudant_query.html#deleting-an-index
        del(spec: QueryDeleteSpec, callback?: nano.Callback<nano.OkResponse>): Promise<nano.OkResponse>;
    }

    interface QueryDeleteSpec {
        ddoc: string;
        name: string;
    }

    interface SearchParams {
        q: string;
        include_docs?: boolean;
        bookmark?: string;
        limit?: number;
        skip?: number;
        stale?: string;
    }

    interface Security {
        cloudant: {[key: string]: string[]},
        [key: string]: any;
    }

    interface BulkGetResponse<D> {
        docs: D[];
    }

    // Server Scope
    // ============

    interface ServerScope extends nano.ServerScope {

        // https://console.bluemix.net/docs/services/Cloudant/api/authorization.html#api-keys
        generate_api_key(callback?: nano.Callback<ApiKey>): Promise<ApiKey>;

        // https://console.bluemix.net/docs/services/Cloudant/api/cors.html#reading-the-cors-configuration
        get_cors(callback?: nano.Callback<CORS>): Promise<CORS>;

        // https://console.bluemix.net/docs/services/Cloudant/api/account.html#ping
        ping(callback?: nano.Callback<{[key:string] : any}>): Promise<{[key:string] : any}>;

        // https://console.bluemix.net/docs/services/Cloudant/api/cors.html#setting-the-cors-configuration
        set_cors(cors: CORS, callback?: nano.Callback<nano.OkResponse>): Promise<nano.OkResponse>;
    }

    // Document Scope
    // ==============

    interface DocumentScope<D> extends nano.DocumentScope<D> {
        // https://console.bluemix.net/docs/services/Cloudant/api/cloudant_query.html
        index: Query;

        // https://console.bluemix.net/docs/services/Cloudant/api/document.html#the-_bulk_get-endpoint
        bulk_get(options: nano.BulkModifyDocsWrapper, callback?: nano.Callback<BulkGetResponse<D>>): Promise<BulkGetResponse<D>>;

        // https://console.bluemix.net/docs/services/Cloudant/api/cloudant-geo.html#cloudant-geospatial
        geo(
            designname: string,
            docname: string,
            params: GeoParams,
            callback?: nano.Callback<GeoResult<GeoDocument>>
        ): Promise<GeoResult<GeoDocument>>;

        // https://console.bluemix.net/docs/services/Cloudant/api/authorization.html#viewing-permissions
        get_security(callback?: nano.Callback<Security>): Promise<Security>;

        // https://console.bluemix.net/docs/services/Cloudant/api/authorization.html#modifying-permissions
        set_security(Security: Security, callback?: nano.Callback<nano.OkResponse>): Promise<nano.OkResponse>;
    }
}

export = cloudant;
