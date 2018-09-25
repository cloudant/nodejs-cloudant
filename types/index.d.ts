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
import { Request, CoreOptions } from "request";

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
        (definition?: any, callback?: Callback<any>): Request;

        // https://console.bluemix.net/docs/services/Cloudant/api/cloudant_query.html#deleting-an-index
        del(spec: QueryDeleteSpec, callback?: Callback<any>): Request;
    }

    interface QueryDeleteSpec {
        ddoc: string;
        name: string;
    }

    // https://console.bluemix.net/docs/services/Cloudant/api/search.html#queries
    interface SearchParams {
        // A bookmark that was received from a previous search. Used for pagination.
        bookmark?: string;
        // An array of field names for which facet counts are requested.
        counts?: string[];
        // Filters the result set using key value pairs supplied to the drilldown parameter.
        drilldown?: string[];
        // The name of a string field to group results by.
        group_field?: string;
        // The maximum group count when used in conjunction with group_field.
        group_limit?: number;
        // Defines the order of the groups in a search when used with group_field.
        group_sort?: string | string[];
        // Which fields are to be highlighted.
        highlight_fields?: string[];
        // String used before a highlighted word. Defaults to <em>.
        highlight_pre_tag?: string;
        // String used after a highlighted word. Defaults to </em>.
        highlight_post_tag?: string;
        // The number of gradments that are returned in highlights. Defaults to 1.
        highlight_number?: number;
        // The number of characters in each fragment for highlight. Defaults to 100.
        highlight_size?: number;
        // Include the full document bodies in the response. Defaults to false
        include_docs?: boolean;
        // An array of fields to include in the search results.
        include_fields?: string[];
        // The maximum number of returned documents. Positive integer up to 200.
        limit?: number;
        // Alias of 'query'. One of q or query must be present.
        q?: string;
        // The Lucene query to perform. One of q or query must be present.
        query?: string;
        // Defines ranges for faceted numeric search fields.
        ranges?: object;
        // Specifies the sort order of the results.
        sort?: string | string[];
        // Do not wait for the index to finish building to return results.
        stale?: boolean;
    }

    interface Security {
        [key: string]: any;
    }

    interface VirtualHost {
        host: string;
        path: string;
    }

    // Server Scope
    // ============

    interface ServerScope extends nano.ServerScope {
        db: nano.DatabaseScope;
        use(db: string): DocumentScope<any>;
        scope(db: string): DocumentScope<any>;

        // https://console.bluemix.net/docs/services/Cloudant/api/vhosts.html#creating-a-virtual-host
        add_virtual_host(virtualHost: VirtualHost, callback?: Callback<any>): Request;

        // https://console.bluemix.net/docs/services/Cloudant/api/vhosts.html#deleting-a-virtual-host
        delete_virtual_host(virtualHost: VirtualHost, callback?: Callback<any>): Request;

        // https://console.bluemix.net/docs/services/Cloudant/api/authorization.html#api-keys
        generate_api_key(callback?: Callback<ApiKey>): Request;

        // https://console.bluemix.net/docs/services/Cloudant/api/cors.html#reading-the-cors-configuration
        get_cors(callback?: Callback<any>): Request;

        // https://console.bluemix.net/docs/services/Cloudant/api/vhosts.html#listing-virtual-hosts
        get_virtual_hosts(callback?: Callback<any>): Request;

        // https://console.bluemix.net/docs/services/Cloudant/api/account.html#ping
        ping(callback?: Callback<any>): Request;

        // https://console.bluemix.net/docs/services/Cloudant/api/cors.html#setting-the-cors-configuration
        set_cors(cors: CORS, callback?: Callback<any>): Request;
    }

    // Document Scope
    // ==============

    interface DocumentScope<D> extends nano.DocumentScope<D> {
        // https://console.bluemix.net/docs/services/Cloudant/api/cloudant_query.html
        index: Query;

        // https://console.bluemix.net/docs/services/Cloudant/api/document.html#the-_bulk_get-endpoint
        bulk_get(options: nano.BulkModifyDocsWrapper, callback?: Callback<any>): Request;

        // https://console.bluemix.net/docs/services/Cloudant/api/cloudant-geo.html#cloudant-geospatial
        geo(
            designname: string,
            docname: string,
            params: GeoParams,
            callback?: Callback<GeoResult>
        ): Request;

        // https://console.bluemix.net/docs/services/Cloudant/api/authorization.html#viewing-permissions
        get_security(callback?: Callback<Security>): Request;

        // https://console.bluemix.net/docs/services/Cloudant/api/search.html
        search(
            designname: string,
            searchname: string,
            params: SearchParams,
            callback: Callback<any>
        ): Request;
        search(
            designname: string,
            searchname: string,
            params: any,
            callback?: Callback<any>
        ): Request;

        // https://console.bluemix.net/docs/services/Cloudant/api/authorization.html#modifying-permissions
        set_security(Security: Security, callback?: Callback<any>): Request;
    }
}

export = cloudant;
