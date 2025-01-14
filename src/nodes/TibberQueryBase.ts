import { IConfig } from '../models/IConfig';
import * as url from 'url';
import https, { RequestOptions } from 'https';
import http from 'http';
import { HttpMethod } from './models/HttpMethod';
import { qglWebsocketSubscriptionUrl } from '../gql/websocketSubscriptionUrl';
import { version } from "../../Version"

export class TibberQueryBase {
    public active: boolean;
    private _config: IConfig;
    public get config(): IConfig {
        return this._config;
    }
    public set config(value: IConfig) {
        this._config = value;
    }

    /**
     *
     */
    constructor(config: IConfig) {
        this.active = false;
        this._config = config;
    }

    /**
     * Try to parse a string and return a valid JSON object. 
     * If string is not valid JSON, it will return an empty object instead.
     * @param input Input string to try to parse as a JSON object
     * @returns Parsed or empty Json object
     */
    protected JsonTryParse(input: string): object {
        try {
            //check if the string exists
            if (input) {
                let o = JSON.parse(input);

                //validate the result too
                if (o && o.constructor === Object) {
                    return o;
                }
            }
        }
        catch (e: any) {
        }

        return { responseMessage: input };
    };

    /**
     *
     * @param method HTTP method to use
     * @param uri Uri to use
     * @returns An object containing request options
     */
    protected getRequestOptions(method: HttpMethod, uri: url.UrlWithParsedQuery): RequestOptions {
        return {
            host: uri.host,
            port: uri.port,
            path: uri.path,
            protocol: uri.protocol,
            method,
            headers: {
                Connection: 'Keep-Alive',
                Accept: 'application/json',
                Host: uri.hostname as string,
                'User-Agent': (`${this._config.apiEndpoint.userAgent ?? ''} bisand/tibber-api/${version}`).trim(),
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this._config.apiEndpoint.apiKey}`,
            },
        };
    }

    /**
     * General GQL query
     * @param query GQL query.
     * @param variables Variables used by query parameter.
     * @return Query result as JSON data
     */
    public async query(query: string, variables?: object): Promise<any> {
        return await new Promise<any>((resolve, reject) => {
            try {
                const uri = url.parse(this._config.apiEndpoint.queryUrl, true);
                const options: RequestOptions = this.getRequestOptions(HttpMethod.Post, uri);
                const data = new TextEncoder().encode(
                    JSON.stringify({
                        query,
                        variables,
                    }),
                );

                const client = (uri.protocol == "https:") ? https : http;
                const req = client.request(options, (res: any) => {
                    let str: string = '';
                    res.on('data', (chunk: string) => {
                        str += chunk;
                    });
                    res.on('end', () => {
                        const response: any = this.JsonTryParse(str);
                        if (res?.statusCode >= 200 && res?.statusCode < 300) {
                            resolve(response.data ? response.data : response);
                        } else {
                            response.httpCode = res?.statusCode;
                            response.statusCode = res?.statusCode;
                            response.statusMessage = res?.statusMessage;
                            reject(response);
                        }
                    });
                });
                req.on('error', (e: any) => {
                    // console.error(`problem with request: ${e.message}`);
                    reject(e);
                });
                if (data) {
                    req.write(data);
                }
                req.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Get selected home with some selected properties, including address and owner.
     * @param homeId Tibber home ID
     * @return IHome object
     */
    public async getWebsocketSubscriptionUrl(): Promise<URL> {
        const result = await this.query(qglWebsocketSubscriptionUrl);
        if (result && result.viewer && result.viewer.websocketSubscriptionUrl) {
            return new URL(result.viewer.websocketSubscriptionUrl);
        }
        return result && result.error ? result : {};
    }

}
