// Copyright © 2018 IBM Corp. All rights reserved.
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
    callback?: (error: any, client?: cloudant.ServerScope, pong?: any) => void
): cloudant.ServerScope;

declare namespace cloudant {
    type Callback<R> = (error: any, response: R, headers?: any) => void;

    interface ApiKey {
        key: string;
        password: string;
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

    interface GeoResult {
        bookmark: string;
        features: any[];
        row: any[];
        type: string;
    }

    interface Query {
        // https://console.bluemix.net/docs/services/Cloudant/api/cloudant_query.html#query
        (definition?: any, callback?: Callback<any>): Promise<any>;

        // https://console.bluemix.net/docs/services/Cloudant/api/cloudant_query.html#deleting-an-index
        del(spec: QueryDeleteSpec, callback?: Callback<any>): Promise<any>;
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
        [key: string]: any;
    }

    // Server Scope
    // ============

    interface ServerScope extends nano.ServerScope {
        db: nano.DatabaseScope;
        use(db: string): DocumentScope<any>;
        scope(db: string): DocumentScope<any>;

        // https://console.bluemix.net/docs/services/Cloudant/api/authorization.html#api-keys
        generate_api_key(callback?: Callback<ApiKey>): Promise<any>;

        // https://console.bluemix.net/docs/services/Cloudant/api/cors.html#reading-the-cors-configuration
        get_cors(callback?: Callback<any>): Promise<any>;

        // https://console.bluemix.net/docs/services/Cloudant/api/account.html#ping
        ping(callback?: Callback<any>): Promise<any>;

        // https://console.bluemix.net/docs/services/Cloudant/api/cors.html#setting-the-cors-configuration
        set_cors(cors: CORS, callback?: Callback<any>): Promise<any>;
    }

    // Document Scope
    // ==============

    interface DocumentScope<D> extends nano.DocumentScope<D> {
        // https://console.bluemix.net/docs/services/Cloudant/api/cloudant_query.html
        index: Query;

        // https://console.bluemix.net/docs/services/Cloudant/api/document.html#the-_bulk_get-endpoint
        bulk_get(options: nano.BulkModifyDocsWrapper, callback?: Callback<any>): Promise<any>;

        // https://console.bluemix.net/docs/services/Cloudant/api/cloudant-geo.html#cloudant-geospatial
        geo(
            designname: string,
            docname: string,
            params: GeoParams,
            callback?: Callback<GeoResult>
        ): Promise<any>;

        // https://console.bluemix.net/docs/services/Cloudant/api/authorization.html#viewing-permissions
        get_security(callback?: Callback<Security>): Promise<any>;

        // https://console.bluemix.net/docs/services/Cloudant/api/authorization.html#modifying-permissions
        set_security(Security: Security, callback?: Callback<any>): Promise<any>;
    }
}

export = cloudant;
