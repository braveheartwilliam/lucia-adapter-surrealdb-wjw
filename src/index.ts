import type {
  Adapter,
  DatabaseSession,
  RegisteredDatabaseSessionAttributes,
  DatabaseUser,
  RegisteredDatabaseUserAttributes,
} from "lucia";

interface UserDoc extends RegisteredDatabaseUserAttributes {
  id: string;
}

interface SessionDoc extends RegisteredDatabaseSessionAttributes {
  id: string;
  user_id: string;
  expires_at: Date;
}

interface TableNames {
  user: string;
  session: string;
}
export class SurrealDBAdapter implements Adapter {
  private connector;
  private table_names: TableNames;

  constructor(connector: any, table_names: TableNames) {
    this.table_names = table_names;
    this.connector = connector;
  }

  public async deleteSession(sessionId: string): Promise<void> {
    await this.connector.query(
      `DELETE ${this.table_names.session}:${sessionId};`
    );
  }

  public async deleteExpiredSessions(): Promise<void> {
    await this.connector.query(
      `DELETE FROM ${this.table_names.session} WHERE expires_at <= time::now();`
    );
  }

  public async deleteUserSessions(userId: string): Promise<void> {
    await this.connector.query(
      `DELETE FROM ${this.table_names.session} WHERE user_id = "${userId}";`
    );
  }

  /*
    getSessionAndUser(): Returns the session and the user linked to the session
  */
  public async getSessionAndUser(
    sessionId: string
  ): Promise<[session: DatabaseSession | null, user: DatabaseUser | null]> {
    let sesh = await this.getSession(sessionId);

    if (!sesh) {
      return [null, null];
    }
    let user = await this.getUserFromSessionId(sesh?.userId);
    if (!user) {
      return [null, null];
    }

    return [sesh, user];
  }

  private async getUserFromSessionId(
    userId: string
  ): Promise<DatabaseUser | null> {
    const result = await this.connector.query(
      `SELECT * FROM ${this.table_names.user}:${userId};`
    );

    if (!result[0][0]) return null;
    return transformIntoDatabaseUser(result[0][0]);
  }

  private async getSession(sessionId: string): Promise<DatabaseSession | null> {
    const result = await this.connector.query(
      `SELECT * FROM ${this.table_names.session}:${sessionId};`
    );

    if (!result[0][0]) return null;
    let transofrmed_data = transformIntoDatabaseSession(result[0][0]);

    return transofrmed_data;
  }

  public async setSession(databaseSession: DatabaseSession): Promise<void> {
    const value = {
      session_id: databaseSession.id,
      user_id: databaseSession.userId,
      expiresAt: databaseSession.expiresAt.toISOString(),
      ...databaseSession.attributes
	};
	  let session_id = value.session_id;
	  let user_id = value.user_id;
	  let expiresAt = value.expiresAt;
	  const insertParams = { session_id, user_id, expiresAt};



	  //   const insertParams = { id:value.id, user:value.user_id, expire:value.expires_at };


	  console.log('-------------------');

	  console.log( '$$$$$value: ', value );

	  console.log( '-------------------' );

    var entries = Object.entries(value).filter(([_, v]) => v !== void 0);
    var columns = entries.map(([k]) => k);
	  var values = entries.map( ( [_, v] ) => escapeName( v ) );
	  	console.log( 'Inserted session' , values[0], values[1], values[2] );


	  console.log('$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$     values: ', values, 'columns: ', columns, 'insertParams: ', insertParams);

    function escapeName(val) {
		return '"' + val + '"';
    }

try
	  {
	//   await this.connector.query( `INSERT INTO ${ this.table_names.session } (id, user_id, expiresAt) VALUES(values[0], values[1], values[2]);`);?,?,?
	await this.connector.query( `INSERT INTO session (session_id, user_id, expiresAt) VALUES ($session_id, $user_id, $expiresAt)` , insertParams);


	  } catch ( e )
	  {
		  console.log( 'Failed to insert session', e );
	  }

  }

  public async getUserSessions(userId: string): Promise<DatabaseSession[]> {
    const result = await this.connector.query(
      `SELECT * FROM ${this.table_names.session} WHERE user_id = "${userId}";`
    );

    if (!result[0][0]) {
      return [];
    }
    return result[0].map((val: any) => {
      return transformIntoDatabaseSession(val);
    });
  }

  public async updateSessionExpiration(
    sessionId: string,
    expiresAt: Date
  ): Promise<void> {
    await this.connector.query(
      `UPDATE ${
        this.table_names.session
      }:${sessionId} SET expires_at = type::datetime("${expiresAt.toISOString()}");`
    );
  }
}

function transformIntoDatabaseSession(raw: SessionDoc): DatabaseSession {
  const {
    id,
    user_id: userId,
    expires_at: expiresAtResult,
    ...attributes
  } = raw;
  let id_without_tablename = sliceTablePrefix(id);

  return {
    userId,
    id: id_without_tablename,
    expiresAt:
      expiresAtResult instanceof Date
        ? expiresAtResult
        : new Date(expiresAtResult),
    attributes,
  };
}

function transformIntoDatabaseUser(raw: UserDoc): DatabaseUser {
  const { id, ...attributes } = raw;
  let id_without_tablename = sliceTablePrefix(id);

  return {
    id: id_without_tablename,
    attributes,
  };
}

function sliceTablePrefix(inputString: string): string {
  const parts = inputString.split(":");

  const result = parts.slice(1).join(":");

  return result;
}
